import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { OrderStatus, WarrantyExtendStatus } from '@prisma/client';
import { MercadoPagoConfig, Payment } from 'mercadopago';
import { sendOrderConfirmationEmail, sendPreorderConfirmationEmail, sendNewOrderAdminNotification, sendLowStockAlert } from '@/lib/email';
import { productCache } from '@/lib/cache';
import crypto from 'crypto';
import { releaseStock, restoreStock } from '@/lib/stock';
import { registerEntry } from '@/lib/accounting';

const client = new MercadoPagoConfig({
  accessToken: process.env.MP_ACCESS_TOKEN!
});

function verifyWebhookSignature(request: NextRequest): boolean {
  if (!process.env.MP_WEBHOOK_SECRET) {
    console.error('[MP Webhook] MP_WEBHOOK_SECRET not configured — rejecting');
    return false;
  }

  const xSignature = request.headers.get('x-signature') || '';
  const xRequestId = request.headers.get('x-request-id') || '';
  if (!xSignature || !xRequestId) return false;

  const sigParts = xSignature.split(',').reduce((acc: Record<string, string>, part) => {
    const [key, ...vals] = part.split('=');
    if (key) acc[key.trim()] = vals.join('=').trim();
    return acc;
  }, {});

  const ts = sigParts['ts'];
  const v1 = sigParts['v1'];
  if (!ts || !v1) return false;

  // Reject requests with timestamp > 5 minutes old (anti-replay)
  const now = Math.floor(Date.now() / 1000);
  const tsNum = parseInt(ts);
  if (isNaN(tsNum) || Math.abs(now - tsNum) > 300) {
    console.error('[MP Webhook] Timestamp out of range:', { now, ts: tsNum });
    return false;
  }

  const url = new URL(request.url);
  const dataId = url.searchParams.get('data.id') || url.searchParams.get('id') || '';

  const manifest = `id:${dataId};request-id:${xRequestId};ts:${ts};`;
  const expectedSignature = crypto
    .createHmac('sha256', process.env.MP_WEBHOOK_SECRET)
    .update(manifest)
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(v1),
    Buffer.from(expectedSignature)
  );
}

interface MPWebhookPayment {
  preference_id?: string
  external_reference?: string
  status?: string
  payment_method_id?: string
  installments?: number
  card?: { installments?: number }
}

export async function POST(request: NextRequest) {
  try {
    if (!verifyWebhookSignature(request)) {
      console.error('[MP Webhook] Invalid signature');
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    const body = await request.json();
    const { type, data, action } = body;

    // Only process payment creation/update events
    if (type === 'payment' && (action === 'payment.created' || action === 'payment.updated')) {
      const paymentId = data.id;

      // Fetch payment details from MP
      const payment = new Payment(client);
      const paymentData = await payment.get({ id: paymentId });

      if (!paymentData) {
        return NextResponse.json({ received: true });
      }

      const pd = paymentData as MPWebhookPayment;
      const preferenceId = pd.preference_id;
      const externalReference = pd.external_reference;
      const status = pd.status;
      const paymentMethod = pd.payment_method_id;
      const installments = pd.installments || 1;

      // Handle gift card payments
      if (externalReference && externalReference.startsWith('gc::')) {
        const gcId = externalReference.replace('gc::', '');
        const gc = await prisma.giftCard.findUnique({ where: { id: gcId } });
        if (gc && (gc.status === 'PENDING' || gc.status === 'ACTIVE')) {
          if (status === 'approved') {
            await prisma.giftCard.update({
              where: { id: gc.id },
              data: {
                status: 'ACTIVE',
                mpPaymentId: paymentId.toString(),
                mpStatus: status,
              }
            });
            console.log('[MP Webhook] GiftCard', gcId, 'payment approved');
          } else if (status === 'rejected' || status === 'cancelled') {
            await prisma.giftCard.update({
              where: { id: gc.id },
              data: { status: 'CANCELLED', mpPaymentId: paymentId.toString(), mpStatus: status }
            });
            console.log('[MP Webhook] GiftCard', gcId, 'cancelled');
          }
        }
        return NextResponse.json({ received: true });
      }

      // Handle warranty extension payments
      if (externalReference && externalReference.startsWith('wext::')) {
        const wextId = externalReference.replace('wext::', '');
        const wext = await prisma.warrantyExtend.findUnique({ where: { id: wextId } });
        if (wext && wext.status === 'PENDING_PAYMENT') {
          const newStatus = status === 'approved' ? 'ACTIVE' : status === 'rejected' || status === 'cancelled' ? 'CANCELLED' : 'PENDING_PAYMENT';
          await prisma.warrantyExtend.update({
            where: { id: wext.id },
            data: {
              status: newStatus as WarrantyExtendStatus,
              mpPaymentId: paymentId.toString(),
              mpStatus: status,
            }
          });
          console.log('[MP Webhook] WarrantyExtend', wextId, '->', newStatus, 'payment:', status);
        }
        return NextResponse.json({ received: true });
      }

      // Find order by preference_id or external_reference (for in-store sales)
      let order = await prisma.order.findFirst({
        where: { mpPreferenceId: preferenceId },
        include: {
          items: {
            include: {
              product: true,
              accessory: true
            }
          }
        }
      });

      // If not found by preference_id, try by external_reference (order code)
      if (!order && externalReference) {
        order = await prisma.order.findFirst({
          where: { code: externalReference },
          include: {
            items: {
              include: {
                product: true,
                accessory: true
              }
            }
          }
        });
      }

      if (!order) {
        console.error('[MP Webhook] Order not found for preference:', preferenceId, 'or external_reference:', externalReference);
        return NextResponse.json({ received: true });
      }

      // Idempotency: if payment already processed, skip
      if (order.mpPaymentId === paymentId.toString()) {
        console.log('[MP Webhook] Payment already processed for order:', order.code);
        return NextResponse.json({ received: true });
      }

      // Determine order status based on payment status
      let orderStatus = order.status;
      
      switch (status) {
        case 'approved':
          orderStatus = 'PROCESSING';
          break;
        case 'pending':
          orderStatus = 'PENDING';
          break;
        case 'rejected':
        case 'cancelled':
        case 'refunded':
        case 'charged_back':
          orderStatus = 'CANCELLED';
          break;
        case 'in_process':
        case 'in_mediation':
          orderStatus = 'PENDING';
          break;
      }

      // Deduct stock if payment approved (release reservation)
      if (status === 'approved') {
        await prisma.$transaction(async (tx) => {
          await releaseStock(tx, order.items, order.code)
        });
      } else if (status === 'rejected' || status === 'cancelled') {
        // Release reserved stock on payment failure
        await prisma.$transaction(async (tx) => {
          await restoreStock(tx, order.items, false, order.code)
        });
      }

      // Update order with payment info
      await prisma.order.update({
        where: { id: order.id },
        data: {
          mpPaymentId: paymentId.toString(),
          mpStatus: status,
          payment: paymentMethod || null,
          cuotas: installments > 1 ? installments : order.cuotas,
          status: orderStatus as OrderStatus
        }
      });

      // Update payment transaction ledger
      if (status === 'approved') {
        await prisma.paymentTransaction.updateMany({
          where: {
            orderId: order.id,
            method: { not: 'coupon' },
            status: 'pending',
          },
          data: {
            status: 'approved',
            mpPaymentId: paymentId.toString(),
            mpStatus: status,
            installments: installments > 1 ? installments : 1,
          }
        });
      } else if (status === 'rejected' || status === 'cancelled') {
        await prisma.paymentTransaction.updateMany({
          where: {
            orderId: order.id,
            method: { not: 'coupon' },
            status: 'pending',
          },
          data: {
            status: 'rejected',
            mpPaymentId: paymentId.toString(),
            mpStatus: status,
          }
        });
      }

      productCache.clear();

      // Create Envío Pack shipment if carrier selected (not store pickup)
      if (status === 'approved' && order.carrier && order.deliveryCost > 0 && !order.enviopackId) {
        try {
          const epRes = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/shipping/enviopack/crear`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              orderCode: order.code,
              carrier: order.carrier,
              service: order.carrierService || 'Estándar',
              destino: {
                nombre: order.clientName || order.clientEmail?.split('@')[0] || 'Cliente',
                email: order.clientEmail || '',
                telefono: order.clientPhone || '',
                dni: order.clientDni || '',
                domicilio: [order.shippingStreet, order.shippingNumber].filter(Boolean).join(' '),
                cp: order.shippingZip || '',
                localidad: order.shippingCity || '',
                provincia: order.shippingProvince || '',
              },
            }),
          });

          if (epRes.ok) {
            const epData = await epRes.json()
            await prisma.order.update({
              where: { id: order.id },
              data: {
                trackingNumber: epData.trackingNumber || null,
                enviopackId: epData.enviopackId || null,
                status: 'SHIPPED',
              },
            })
            order.trackingNumber = epData.trackingNumber || order.trackingNumber
            order.status = OrderStatus.SHIPPED
            console.log('[MP Webhook] Envío Pack shipment created for order:', order.code, 'tracking:', epData.trackingNumber)
          }
        } catch (epError) {
          console.error('[MP Webhook] Envío Pack shipment error:', epError)
        }
      }

      // Send confirmation email if payment approved
      if (status === 'approved' && order.clientEmail) {
        try {
          if (order.saleChannel === 'preorder') {
            // Update PreOrder records
            const preOrderUpdates = await prisma.preOrder.updateMany({
              where: { orderId: order.id, source: 'online' },
              data: {
                status: 'COMPRADO', // canónico (antes 'CONFIRMED')
                mpPaymentId: paymentId.toString(),
              }
            });
            // Fetch preorder data for email
            const preOrders = await prisma.preOrder.findMany({
              where: { orderId: order.id, source: 'online' },
              include: { product: true }
            });
            if (preOrders.length > 0) {
              await sendPreorderConfirmationEmail({
                email: order.clientEmail,
                clientName: order.clientName || order.clientEmail?.split('@')[0] || 'Cliente',
                preOrders: preOrders.map(po => ({
                  code: po.code,
                  productName: po.product?.name || po.productModelName || 'Producto',
                  storage: po.productStorage || '',
                  color: po.productColor || '',
                  price: po.price,
                  availableFrom: po.product?.availableFrom || null,
                })),
                paymentMethod: paymentMethod || 'Mercado Pago',
                installments,
              });
            }
          } else {
            await sendOrderConfirmationEmail({
              orderCode: order.code,
              email: order.clientEmail,
            phone: order.clientPhone || '',
            total: order.total,
            items: order.items.map(item => ({
              name: item.product?.name || 'Producto',
              quantity: item.quantity,
              price: item.price
            })),
            shippingAddress: [order.shippingStreet, order.shippingNumber, order.shippingFloor, order.shippingCity, order.shippingProvince, order.shippingZip].filter(Boolean).join(', '),
            paymentMethod: paymentMethod || 'Mercado Pago',
            installments: installments,
            trackingNumber: order.trackingNumber || undefined,
            carrier: order.carrier || undefined,
          });
          }
          } catch (emailError) {
          console.error('[MP Webhook] Error sending confirmation email:', emailError);
        }

        // Notify admin of new order
        try {
          await sendNewOrderAdminNotification({
            orderCode: order.code,
            clientName: order.clientName || 'Cliente',
            total: order.total,
            itemCount: order.items.length,
            paymentMethod: paymentMethod || 'Mercado Pago',
          })
        } catch { /* non-blocking */ }

        // Check low stock
        try {
          const lowStockItems = order.items.filter(item => {
            const productStock = item.product?.stock ?? 0
            return productStock >= 0 && productStock <= 3
          })
          for (const item of lowStockItems) {
            await sendLowStockAlert({
              productName: item.product?.name || 'Producto',
              stock: item.product?.stock ?? 0,
              productId: item.productId || 'unknown',
            })
          }
} catch { /* non-blocking */ }
      }

      // Núcleo contable: registrar el ingreso del pago online aprobado.
      // Si el cliente financió en cuotas, la caja lo separa como CUOTAS (el
      // dinero entra con otro timing/costo que un pago de contado online).
      if (status === 'approved') {
        try {
          const nCuotas = Number(installments) || order.cuotas || 1
          const means = nCuotas > 1 ? 'CUOTAS' : 'PAGO_ONLINE'
          const desglose = [
            order.deliveryCost > 0 ? `envío ${order.deliveryCost}` : null,
            order.warrantyCost > 0 ? `garantía ext. ${order.warrantyCost}` : null,
          ].filter(Boolean).join(', ')
          await registerEntry({
            source: order.saleChannel === 'preorder' ? 'PREORDER' : 'ONLINE',
            operationId: order.code,
            description:
              `Pago online ${order.saleChannel === 'preorder' ? '(preventa) ' : ''}— ${paymentMethod || 'Mercado Pago'}` +
              (nCuotas > 1 ? ` (${nCuotas} cuotas)` : '') +
              (desglose ? ` [incluye ${desglose}]` : ''),
            category: order.saleChannel === 'preorder' ? 'Preventas' : 'Ventas',
            type: 'INGRESO',
            means,
            amount: order.total,
            metadata: {
              productos: order.total - (order.deliveryCost || 0) - (order.warrantyCost || 0),
              envio: order.deliveryCost || 0,
              garantiaExtendida: order.warrantyCost || 0,
              cuotas: nCuotas,
            },
            createdById: null,
          })
        } catch (entryErr) {
          console.error('[MP Webhook] Error registrando asiento:', entryErr)
        }
      }

      console.log('[MP Webhook] Order', order.code, 'updated to', orderStatus, 'payment:', status);
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook error' },
      { status: 500 }
    );
  }
}
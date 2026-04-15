// 订阅购买 API

import { NextRequest, NextResponse } from 'next/server';
import { getUserIdFromToken } from '@/lib/game/auth-service';
import { 
  createOrder, 
  completePayment, 
  upgradeSubscription,
  SUBSCRIPTION_TIERS 
} from '@/lib/game/subscription-service';

export async function POST(request: NextRequest) {
  try {
    const userId = getUserIdFromToken(request.headers.get('authorization'));
    if (!userId) {
      return NextResponse.json({ success: false, error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { action, tierCode, paymentMethod } = body;

    // 获取会员等级信息
    const tier = SUBSCRIPTION_TIERS[tierCode as keyof typeof SUBSCRIPTION_TIERS];
    if (!tier) {
      return NextResponse.json({ success: false, error: '无效的会员等级' }, { status: 400 });
    }

    // 创建订单
    if (action === 'create_order') {
      const order = await createOrder(userId, tierCode, tier.price || 0, paymentMethod);
      return NextResponse.json({
        success: true,
        data: {
          orderNo: order.order_no,
          amount: tier.price || 0,
          tierName: tier.name,
        },
      });
    }

    // 模拟支付成功（实际项目中应接入真实支付）
    if (action === 'pay') {
      const { orderNo } = body;
      if (!orderNo) {
        return NextResponse.json({ success: false, error: '缺少订单号' }, { status: 400 });
      }
      
      await completePayment(orderNo);
      return NextResponse.json({
        success: true,
        message: '购买成功',
        data: { tierCode, tierName: tier.name },
      });
    }

    // 直接升级（用于免费试用或管理员操作）
    if (action === 'upgrade') {
      const durationDays = body.durationDays || 30;
      await upgradeSubscription(userId, tierCode, durationDays);
      return NextResponse.json({
        success: true,
        message: '升级成功',
        data: { tierCode, tierName: tier.name },
      });
    }

    return NextResponse.json({ success: false, error: '未知操作' }, { status: 400 });
  } catch (error) {
    console.error('Subscription purchase error:', error);
    return NextResponse.json({ success: false, error: '购买失败' }, { status: 500 });
  }
}

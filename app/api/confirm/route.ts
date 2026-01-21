import { NextRequest, NextResponse } from 'next/server';
import { handleConfirmation } from '../chat/route';

export async function POST(request: NextRequest) {
  try {
    const { confirmationId, approved } = await request.json();

    if (!confirmationId || typeof approved !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid confirmation data' },
        { status: 400 }
      );
    }

    const handled = await handleConfirmation(confirmationId, approved);

    if (!handled) {
      return NextResponse.json(
        { error: 'Confirmation not found or expired' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, approved });
  } catch (error: any) {
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

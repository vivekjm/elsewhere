/**
 * Settling up with UPI (India). Tripsloom never handles money: it opens the person's own UPI app with the payee,
 * amount and a note filled in, and the payment happens there. The receiver then marks it as received.
 * Only the payee enters their own UPI ID (in Travel preferences), so nobody can redirect a friend's payment.
 */
import { Linking } from 'react-native';
import { isUpiId } from '../data';

/** A `upi://pay` link, NPCI's common format understood by GPay, PhonePe, Paytm, BHIM and bank apps. */
export function upiLink(payee: { upi: string; name: string }, amount: number, note: string): string | null {
  if (!isUpiId(payee.upi) || !(amount > 0)) return null;
  const q = new URLSearchParams({
    pa: payee.upi.trim().toLowerCase(),
    pn: payee.name.slice(0, 40),
    am: amount.toFixed(2),
    cu: 'INR',
    tn: note.slice(0, 50),
  });
  return `upi://pay?${q.toString().replace(/\+/g, '%20')}`;
}

/** Opens the UPI app chooser. False when no UPI app is installed (or the link is invalid). */
export async function payWithUpi(payee: { upi: string; name: string }, amount: number, note: string): Promise<boolean> {
  const link = upiLink(payee, amount, note);
  if (!link) return false;
  try {
    await Linking.openURL(link);
    return true;
  } catch {
    return false;
  }
}

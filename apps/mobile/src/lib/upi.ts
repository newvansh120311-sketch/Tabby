import { Alert, Linking } from 'react-native';
import { TabbyNative } from '../../modules/tabby-native';

/** Open a upi://pay link. Android shows its chooser for GPay, PhonePe, Paytm, BHIM and the rest. */
export async function payWithUpi(uri: string): Promise<boolean> {
  if (!TabbyNative.hasUpiApp()) {
    Alert.alert(
      'No UPI app found',
      'Install a UPI app like Google Pay, PhonePe, Paytm or BHIM, or pay from another phone by scanning the QR code on the bill’s web page.',
    );
    return false;
  }
  try {
    await Linking.openURL(uri);
    return true;
  } catch {
    Alert.alert('Couldn’t open a UPI app', 'Try again, or pay from another phone using the QR code.');
    return false;
  }
}

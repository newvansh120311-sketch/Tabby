import { useState } from 'react';
import { Modal, Pressable, Share, View } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import QRCode from 'react-native-qrcode-svg';
import { Button, Text } from './ui';

/** Share a link three ways: the Android share sheet, copy, or a QR code to scan across the table. */
export function ShareLink({ url, title, message }: { url: string; title: string; message: string }) {
  const [qr, setQr] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <View className="gap-2">
      <Button title="Share link" onPress={() => Share.share({ message: `${message}\n${url}`, url, title })} />
      <View className="flex-row gap-2">
        <Button
          className="flex-1"
          variant="secondary"
          title={copied ? 'Copied' : 'Copy link'}
          onPress={async () => {
            await Clipboard.setStringAsync(url);
            void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            setCopied(true);
            setTimeout(() => setCopied(false), 1500);
          }}
        />
        <Button className="flex-1" variant="secondary" title="Show QR code" onPress={() => setQr(true)} />
      </View>
      <Modal visible={qr} transparent animationType="fade" onRequestClose={() => setQr(false)}>
        <Pressable className="flex-1 items-center justify-center bg-black/60 px-6" onPress={() => setQr(false)} accessibilityLabel="Close QR code">
          <Pressable className="items-center gap-4 rounded-2xl bg-white p-6" onPress={() => undefined}>
            <QRCode value={url} size={240} />
            <Text className="text-center text-[#1d1a16]">Scan with a phone camera to open {title}</Text>
            <Text className="text-center text-xs text-[#6b645a]">{url.replace(/^https?:\/\//, '')}</Text>
            <Button variant="secondary" title="Done" onPress={() => setQr(false)} />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

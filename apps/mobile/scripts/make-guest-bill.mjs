// Test helper: make a throwaway bill hosted by another "device", then open its link on the emulator.
import { execFileSync } from 'node:child_process';
const B = process.env.API_URL ?? 'https://tabby-split-amber.vercel.app';
const host = `maestro-host-${Date.now()}`;
const r = await fetch(`${B}/api/bills`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-device-token': host },
  body: JSON.stringify({
    title: 'Maestro guest test', currency: 'INR', hostName: 'Asha', hostUpiId: 'asha.test@okaxis', source: 'receipt',
    items: [{ name: 'Filter coffee', amountMinor: 6000 }, { name: 'Idli plate', amountMinor: 9000 }],
    charges: [{ type: 'tax', label: 'GST 5%', amountMinor: 750 }],
  }),
});
const { bill } = await r.json();
console.log(bill.url, host);
execFileSync(process.env.ADB ?? 'adb', ['shell', 'am', 'start', '-a', 'android.intent.action.VIEW', '-c', 'android.intent.category.BROWSABLE', '-d', bill.url], { stdio: 'inherit' });

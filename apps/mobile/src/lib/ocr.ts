import * as ImageManipulator from 'expo-image-manipulator';
import { linesToText } from '@tabby/core';
import { TabbyNative } from '../../modules/tabby-native';

/** Read an image with on-device ML Kit and return text with receipt rows rebuilt. */
export async function readImage(uri: string): Promise<string> {
  // Very large photos slow ML Kit down without helping accuracy; cap the long edge.
  let src = uri;
  try {
    const ctx = ImageManipulator.ImageManipulator.manipulate(uri);
    ctx.resize({ width: 2000 });
    const img = await ctx.renderAsync();
    const out = await img.saveAsync({ compress: 0.92, format: ImageManipulator.SaveFormat.JPEG });
    src = out.uri;
  } catch {
    /* use the original */
  }
  const result = await TabbyNative.recognizeText(src);
  const text = result.lines.length ? linesToText(result.lines) : result.text;
  if (!text.trim()) throw new Error('We couldn’t find any text in that image. Try a sharper photo, or type the bill in.');
  return text;
}

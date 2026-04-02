import * as DocumentPicker from 'expo-document-picker';
import { File, Directory, Paths } from 'expo-file-system';

const CUSTOM_SOUND_DIR_NAME = 'custom-sounds';

function getCustomSoundDir(): Directory {
  return new Directory(Paths.document, CUSTOM_SOUND_DIR_NAME);
}

export interface PickResult {
  uri: string;
  name: string;
}

export async function pickAudioFile(): Promise<PickResult | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: 'audio/*',
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.length) return null;

  const asset = result.assets[0];
  const originalName = asset.name ?? 'Custom Sound';

  const dir = getCustomSoundDir();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }

  cleanupOldCustomSound();

  const extension = originalName.includes('.')
    ? `.${originalName.split('.').pop()}`
    : '.audio';
  const destFile = new File(dir, `custom-alarm${extension}`);
  const sourceFile = new File(asset.uri);
  sourceFile.copy(destFile);

  return { uri: destFile.uri, name: originalName };
}

export function cleanupOldCustomSound(): void {
  try {
    const dir = getCustomSoundDir();
    if (!dir.exists) return;
    const items = dir.list();
    for (const item of items) {
      item.delete();
    }
  } catch {}
}

export function deleteCustomSound(uri: string): void {
  try {
    const file = new File(uri);
    if (file.exists) {
      file.delete();
    }
  } catch {}
}

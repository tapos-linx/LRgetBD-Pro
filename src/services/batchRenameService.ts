import { QueueTask, VerifiedBlobRecord } from '../types/land';

export type RenameMode = 'REGEX' | 'TEMPLATE';

export interface RenamePreset {
  id: string;
  name: string;
  description: string;
  mode: RenameMode;
  template?: string;
  regexPattern?: string;
  regexFlags?: string;
  regexReplacement?: string;
}

export const RENAME_PRESETS: RenamePreset[] = [
  {
    id: 'forensic-standard',
    name: 'Forensic Standard (Default)',
    description: 'District_Upazila_JL-[No]_[Mouza]_[Survey]_[Mode]_[Style].pdf',
    mode: 'TEMPLATE',
    template: '{district}_{upazila}_JL-{jl}_{mouza}_{survey}_{mode}_{style}.pdf',
  },
  {
    id: 'concise-archive',
    name: 'Concise Mouza Archive',
    description: 'JL-{jl}_{mouza}_{survey}_{mode}.pdf',
    mode: 'TEMPLATE',
    template: 'JL-{jl}_{mouza}_{survey}_{mode}.pdf',
  },
  {
    id: 'bengali-regional',
    name: 'Bangla Regional Format',
    description: '{districtBn}_{upazilaBn}_{mouzaBn}_JL-{jl}_{survey}.pdf',
    mode: 'TEMPLATE',
    template: '{districtBn}_{upazilaBn}_{mouzaBn}_JL-{jl}_{survey}.pdf',
  },
  {
    id: 'folder-compact',
    name: 'Compact Survey Name',
    description: '{mouza}_{survey}_KhatianBook.pdf',
    mode: 'TEMPLATE',
    template: '{mouza}_{survey}_KhatianBook.pdf',
  },
  {
    id: 'regex-strip-spaces',
    name: 'Regex: Normalize Whitespace to Underscores',
    description: 'Replaces spaces and hyphens with clean underscores',
    mode: 'REGEX',
    regexPattern: '[\\s-]+',
    regexFlags: 'g',
    regexReplacement: '_',
  },
  {
    id: 'regex-uppercase-survey',
    name: 'Regex: Prefix LandRecord_',
    description: 'Prefixes each filename with LandRecord_BD_',
    mode: 'REGEX',
    regexPattern: '^',
    regexFlags: '',
    regexReplacement: 'LandRecord_BD_',
  },
];

export function sanitizeFileName(name: string): string {
  const clean = name
    .replace(/[/\\?%*:|"<>]/g, '_')
    .replace(/\s+/g, '_')
    .trim();
  return clean.endsWith('.pdf') ? clean : `${clean}.pdf`;
}

export function applyTemplateRename(task: QueueTask, template: string): string {
  let result = template;
  const styleStr = task.bookStyle
    ? `${task.bookStyle.layout}-${task.bookStyle.colorMode}`
    : 'default';

  const tokens: Record<string, string> = {
    '{district}': task.districtNameEn || 'District',
    '{districtBn}': task.districtNameBn || 'জেলা',
    '{upazila}': task.upazilaNameEn || 'Upazila',
    '{upazilaBn}': task.upazilaNameBn || 'উপজেলা',
    '{union}': task.unionNameEn || 'Union',
    '{unionBn}': task.unionNameBn || 'ইউনিয়ন',
    '{jl}': task.mouzaJlNo || '0',
    '{mouza}': task.mouzaNameEn || 'Mouza',
    '{mouzaBn}': task.mouzaNameBn || 'মৌজা',
    '{survey}': task.surveyType || 'SURVEY',
    '{mode}': task.endpointType || 'khatian',
    '{layout}': task.bookStyle?.layout || 'new',
    '{color}': task.bookStyle?.colorMode || 'color',
    '{style}': styleStr,
    '{khatian}': task.khatianNo || 'ALL',
    '{sheet}': task.mapSheetNo ? String(task.mapSheetNo) : '1',
    '{id}': task.id,
  };

  for (const [token, value] of Object.entries(tokens)) {
    result = result.split(token).join(value);
  }

  return sanitizeFileName(result);
}

export function applyRegexRename(
  currentFileName: string,
  pattern: string,
  flags: string,
  replacement: string
): { newFileName: string; error?: string } {
  if (!pattern) {
    return { newFileName: currentFileName };
  }

  try {
    const regex = new RegExp(pattern, flags);
    const replaced = currentFileName.replace(regex, replacement);
    const sanitized = sanitizeFileName(replaced);
    return { newFileName: sanitized };
  } catch (err) {
    return {
      newFileName: currentFileName,
      error: err instanceof Error ? err.message : 'Invalid Regular Expression syntax',
    };
  }
}

export interface RenamePreviewItem {
  taskId: string;
  mouzaJlNo: string;
  mouzaNameEn: string;
  mouzaNameBn: string;
  surveyType: string;
  currentFileName: string;
  newFileName: string;
  isChanged: boolean;
  hasCachedBlob: boolean;
}

export function computeBatchRenamePreview(params: {
  tasks: QueueTask[];
  verifiedBlobTaskIds: Set<string>;
  mode: RenameMode;
  templatePattern: string;
  regexPattern: string;
  regexFlags: string;
  regexReplacement: string;
}): {
  previewItems: RenamePreviewItem[];
  changedCount: number;
  regexError?: string;
} {
  const {
    tasks,
    verifiedBlobTaskIds,
    mode,
    templatePattern,
    regexPattern,
    regexFlags,
    regexReplacement,
  } = params;

  let globalRegexError: string | undefined;

  if (mode === 'REGEX' && regexPattern) {
    try {
      new RegExp(regexPattern, regexFlags);
    } catch (e) {
      globalRegexError = e instanceof Error ? e.message : 'Invalid RegExp syntax';
    }
  }

  let changedCount = 0;
  const previewItems: RenamePreviewItem[] = [];

  for (const task of tasks) {
    const hasCachedBlob = verifiedBlobTaskIds.has(task.id);
    let newFileName = task.fileName;

    if (!globalRegexError) {
      if (mode === 'TEMPLATE') {
        newFileName = applyTemplateRename(task, templatePattern);
      } else {
        const regexRes = applyRegexRename(
          task.fileName,
          regexPattern,
          regexFlags,
          regexReplacement
        );
        newFileName = regexRes.newFileName;
      }
    }

    const isChanged = newFileName !== task.fileName;
    if (isChanged && hasCachedBlob) {
      changedCount++;
    }

    previewItems.push({
      taskId: task.id,
      mouzaJlNo: task.mouzaJlNo,
      mouzaNameEn: task.mouzaNameEn,
      mouzaNameBn: task.mouzaNameBn,
      surveyType: task.surveyType,
      currentFileName: task.fileName,
      newFileName,
      isChanged,
      hasCachedBlob,
    });
  }

  return {
    previewItems,
    changedCount,
    regexError: globalRegexError,
  };
}

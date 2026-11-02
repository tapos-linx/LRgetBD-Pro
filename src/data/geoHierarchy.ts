import {
  BookStyleConfig,
  DivisionNode,
  EporchaDocType,
  EporchaEndpointType,
  MouzaNode,
  SurveyType,
} from '../types/land';
import {
  BANGLADESH_NATIONWIDE_HIERARCHY,
  createMouzaList,
  generateMouzasForUpazila,
  NABINAGAR_MOUZAS,
} from './bangladeshNationwideHierarchy';

export { createMouzaList, generateMouzasForUpazila, NABINAGAR_MOUZAS };

export const ALL_ENDPOINT_TYPES: EporchaEndpointType[] = [
  'mouza-vittik-khatian',
  'mouza-vittik-dag',
  'survey-khatian',
  'namjari-khatian',
  'mouza-map',
  'khatian-index',
];

export const ALL_SURVEY_TYPES: SurveyType[] = [
  'CS',
  'SA',
  'RS',
  'BS',
  'MUTATION',
];

export const ENDPOINT_MODE_META: Record<
  EporchaEndpointType,
  {
    docType: EporchaDocType;
    titleEn: string;
    titleBn: string;
    path: string;
    fullUrl: string;
    badgeBn: string;
    description: string;
  }
> = {
  'mouza-vittik-khatian': {
    docType: 'MOUZA_KHATIAN_BOOK',
    titleEn: 'Mouza Full Khatian Book PDF',
    titleBn: 'পূর্ণ মৌজা খতিয়ান বই PDF',
    path: '/mouza-vittik-khatian',
    fullUrl: 'https://eporcha.tech/mouza-vittik-khatian',
    badgeBn: 'পূর্ণ মৌজা PDF ডাউনলোড',
    description:
      'Generates & downloads the complete Mouza Khatian Book PDF (CS, SA, RS, BS, Mutation) in New/Old & Color/B&W styles.',
  },
  'mouza-vittik-dag': {
    docType: 'MOUZA_DAG_BOOK',
    titleEn: 'Mouza Full Dag Book PDF',
    titleBn: 'পূর্ণ মৌজা দাগ বই PDF',
    path: '/mouza-vittik-dag',
    fullUrl: 'https://eporcha.tech/mouza-vittik-dag',
    badgeBn: 'পূর্ণ মৌজা দাগ বই PDF',
    description:
      'Generates & downloads the complete Mouza Dag Book PDF mapping every serial Dag number in a Mouza to its Khatian numbers.',
  },
  'survey-khatian': {
    docType: 'SURVEY_KHATIAN',
    titleEn: 'Survey Khatian Lookup & PDF',
    titleBn: 'সার্ভে খতিয়ান রেকর্ড ও PDF',
    path: '/survey-khatian',
    fullUrl: 'https://eporcha.tech/survey-khatian',
    badgeBn: 'সার্ভে খতিয়ান',
    description:
      'Direct land ledger search across individual Khatian numbers for CS, SA, RS, and BS land records.',
  },
  'namjari-khatian': {
    docType: 'NAMJARI_KHATIAN',
    titleEn: 'Namjari / Mutation Khatian',
    titleBn: 'নামজারি খতিয়ান ও PDF',
    path: '/namjari-khatian',
    fullUrl: 'https://eporcha.tech/namjari-khatian',
    badgeBn: 'নামজারি মিউটেশন',
    description:
      'Cascading lookup for Mutation/Namjari Khatian list and individual Mutation Khatian PDF verification.',
  },
  'mouza-map': {
    docType: 'MOUZA_MAP',
    titleEn: 'Mouza Map Sheet PDF',
    titleBn: 'মৌজা ম্যাপ PDF শিট',
    path: '/mouza-map',
    fullUrl: 'https://eporcha.tech/mouza-map',
    badgeBn: 'মৌজা নকশা PDF',
    description:
      'Searches and downloads available Mouza Map sheets (মৌজা ম্যাপ PDF) by Mouza JL number and sheet number.',
  },
  'khatian-index': {
    docType: 'KHATIAN_INDEX',
    titleEn: 'Khatian Index & Ownership Summary PDF',
    titleBn: 'খতিয়ান সূচিপত্র ও মালিকানা বিবরণী PDF',
    path: '/khatian-index',
    fullUrl: 'https://eporcha.tech/khatian-index',
    badgeBn: 'খতিয়ান সূচি বিবরণী',
    description:
      'Generates & downloads the complete Khatian Index & Ownership Summary PDF table mapping every Khatian serial in a Mouza.',
  },
};

export const SURVEY_LABELS: Record<SurveyType, { labelEn: string; labelBn: string }> = {
  CS: { labelEn: 'CS (Cadastral Survey)', labelBn: 'সিএস (CS)' },
  SA: { labelEn: 'SA (State Acquisition)', labelBn: 'এসএ (SA)' },
  RS: { labelEn: 'RS (Revisional Survey)', labelBn: 'আরএস (RS)' },
  BS: { labelEn: 'BS / BRS (Bangladesh Survey)', labelBn: 'বিএস / বিআরএস (BS)' },
  MUTATION: { labelEn: 'Mutation / Namjari', labelBn: 'নামজারি (Mutation)' },
};

// Nationwide Hierarchy containing ALL 8 Divisions and ALL 64 Districts of Bangladesh
export const GEO_HIERARCHY: DivisionNode[] = BANGLADESH_NATIONWIDE_HIERARCHY;

export function sanitizeSegment(input: string): string {
  return input
    .trim()
    .replace(/[^a-zA-Z0-9\u0980-\u09FF_-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

export function buildForensicFileName(params: {
  districtNameEn: string;
  upazilaNameEn: string;
  mouzaJlNo: string;
  mouzaNameEn: string;
  surveyType: SurveyType;
  endpointType: EporchaEndpointType;
  bookStyle?: BookStyleConfig;
  khatianNo?: string;
  mapSheetNo?: number;
}): string {
  const dist = sanitizeSegment(params.districtNameEn);
  const upz = sanitizeSegment(params.upazilaNameEn);
  const jl = sanitizeSegment(params.mouzaJlNo);
  const mz = sanitizeSegment(params.mouzaNameEn);
  const srv = sanitizeSegment(params.surveyType);

  switch (params.endpointType) {
    case 'mouza-vittik-khatian': {
      const styleTag = params.bookStyle
        ? `${params.bookStyle.layout}-${params.bookStyle.colorMode}`
        : 'new-color';
      return `${dist}_${upz}_JL-${jl}_${mz}_${srv}_KHATIAN_BOOK_${styleTag}.pdf`;
    }
    case 'mouza-vittik-dag': {
      return `${dist}_${upz}_JL-${jl}_${mz}_${srv}_DAG_BOOK_full.pdf`;
    }
    case 'survey-khatian': {
      const kh = sanitizeSegment(params.khatianNo || 'INDEX');
      return `${dist}_${upz}_JL-${jl}_${mz}_${srv}_Khatian-${kh}.pdf`;
    }
    case 'namjari-khatian': {
      const kh = sanitizeSegment(params.khatianNo || 'MUTATION-INDEX');
      return `${dist}_${upz}_JL-${jl}_${mz}_MUTATION_Khatian-${kh}.pdf`;
    }
    case 'mouza-map': {
      const sheet = params.mapSheetNo ?? 1;
      return `${dist}_${upz}_JL-${jl}_${mz}_${srv}_MOUZA_MAP_Sheet-${sheet}.pdf`;
    }
    case 'khatian-index': {
      return `${dist}_${upz}_JL-${jl}_${mz}_${srv}_KHATIAN_INDEX_ledger.pdf`;
    }
  }
}

export function buildEporchaTargetUrl(params: {
  endpointType: EporchaEndpointType;
  divisionSlug: string;
  districtSlug: string;
  upazilaSlug: string;
  mouza: MouzaNode;
  surveyType: SurveyType;
  bookStyle?: BookStyleConfig;
  khatianNo?: string;
  mapSheetNo?: number;
}): string {
  const base = `https://eporcha.tech/${params.endpointType}`;
  const query = new URLSearchParams({
    division: params.divisionSlug,
    district: params.districtSlug,
    upazila: params.upazilaSlug,
    mouza_jl: params.mouza.jlNo,
    mouza: params.mouza.nameEn.toLowerCase(),
    survey: params.surveyType.toLowerCase(),
  });

  if (params.endpointType === 'mouza-vittik-khatian' && params.bookStyle) {
    query.set('format', params.bookStyle.layout);
    query.set('color', params.bookStyle.colorMode);
    query.set('download', 'full_mouza_pdf');
  } else if (params.endpointType === 'mouza-vittik-dag') {
    query.set('download', 'full_dag_book_pdf');
  } else if (
    (params.endpointType === 'survey-khatian' || params.endpointType === 'namjari-khatian') &&
    params.khatianNo
  ) {
    query.set('khatian_no', params.khatianNo);
  } else if (params.endpointType === 'mouza-map') {
    query.set('sheet_no', String(params.mapSheetNo ?? 1));
  } else if (params.endpointType === 'khatian-index') {
    query.set('download', 'khatian_index_pdf');
  }

  return `${base}?${query.toString()}`;
}

export function generateTasksForMouzasAndEndpoints(params: {
  divisionNameEn: string;
  divisionSlug: string;
  districtNameEn: string;
  districtNameBn: string;
  districtSlug: string;
  upazilaNameEn: string;
  upazilaNameBn: string;
  upazilaSlug: string;
  mouzas: MouzaNode[];
  endpoints: EporchaEndpointType[];
  surveys: SurveyType[];
  bookStyle: BookStyleConfig;
  khatianNo?: string;
  mapSheetNo?: number;
}): import('../types/land').QueueTask[] {
  const nowIso = new Date().toISOString();
  const tasks: import('../types/land').QueueTask[] = [];
  let seq = 0;

  for (const mouza of params.mouzas) {
    for (const ep of params.endpoints) {
      const effectiveSurveys: SurveyType[] =
        ep === 'namjari-khatian' ? ['MUTATION'] : params.surveys;

      for (const survey of effectiveSurveys) {
        seq++;
        const fileName = buildForensicFileName({
          districtNameEn: params.districtNameEn,
          upazilaNameEn: params.upazilaNameEn,
          mouzaJlNo: mouza.jlNo,
          mouzaNameEn: mouza.nameEn,
          surveyType: survey,
          endpointType: ep,
          bookStyle: ep === 'mouza-vittik-khatian' ? params.bookStyle : undefined,
          khatianNo:
            ep === 'survey-khatian' || ep === 'namjari-khatian'
              ? params.khatianNo || 'ALL'
              : undefined,
          mapSheetNo: ep === 'mouza-map' ? params.mapSheetNo || 1 : undefined,
        });

        const targetUrl = buildEporchaTargetUrl({
          endpointType: ep,
          divisionSlug: params.divisionSlug,
          districtSlug: params.districtSlug,
          upazilaSlug: params.upazilaSlug,
          mouza,
          surveyType: survey,
          bookStyle: ep === 'mouza-vittik-khatian' ? params.bookStyle : undefined,
          khatianNo:
            ep === 'survey-khatian' || ep === 'namjari-khatian'
              ? params.khatianNo || 'ALL'
              : undefined,
          mapSheetNo: ep === 'mouza-map' ? params.mapSheetNo || 1 : undefined,
        });

        tasks.push({
          id: `task-${params.upazilaSlug}-${mouza.jlNo}-${ep}-${survey}-${seq}`,
          endpointType: ep,
          docType: ENDPOINT_MODE_META[ep].docType,
          divisionNameEn: params.divisionNameEn,
          districtNameEn: params.districtNameEn,
          districtNameBn: params.districtNameBn,
          upazilaNameEn: params.upazilaNameEn,
          upazilaNameBn: params.upazilaNameBn,
          unionNameEn: mouza.unionNameEn,
          unionNameBn: mouza.unionNameBn,
          mouzaId: mouza.id,
          mouzaJlNo: mouza.jlNo,
          mouzaNameEn: mouza.nameEn,
          mouzaNameBn: mouza.nameBn,
          surveyType: survey,
          bookStyle:
            ep === 'mouza-vittik-khatian' ? { ...params.bookStyle } : undefined,
          khatianNo:
            ep === 'survey-khatian' || ep === 'namjari-khatian'
              ? params.khatianNo || 'ALL'
              : undefined,
          mapSheetNo: ep === 'mouza-map' ? params.mapSheetNo || 1 : undefined,
          fileName,
          targetUrl,
          status: 'QUEUED',
          pdfVerified: false,
          createdAt: nowIso,
          updatedAt: nowIso,
          retryCount: 0,
        });
      }
    }
  }

  return tasks;
}

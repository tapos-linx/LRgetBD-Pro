import {
  BookStyleConfig,
  DivisionNode,
  EporchaDocType,
  EporchaEndpointType,
  MouzaNode,
  SurveyType,
} from '../types/land';

export const ALL_ENDPOINT_TYPES: EporchaEndpointType[] = [
  'mouza-vittik-khatian',
  'mouza-vittik-dag',
  'survey-khatian',
  'namjari-khatian',
  'mouza-map',
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
    titleBn: 'সার্ভে খতিয়ান অনুসন্ধান ও PDF',
    path: '/survey-khatian',
    fullUrl: 'https://eporcha.tech/survey-khatian',
    badgeBn: 'CS · SA · RS · BS খতিয়ান',
    description:
      'Extracts Khatian index (খতিয়ান নম্বর, মালিক/দলিলধারী, দাগ নম্বর, মোট জমি) and individual Survey Khatian PDFs.',
  },
  'namjari-khatian': {
    docType: 'NAMJARI_KHATIAN',
    titleEn: 'Namjari / Mutation Khatian',
    titleBn: 'নামজারি খতিয়ান ও PDF',
    path: '/namjari-khatian',
    fullUrl: 'https://eporcha.tech/namjari-khatian',
    badgeBn: 'মিউটেশন / নামজারি',
    description:
      'Cascading lookup for Mutation/Namjari Khatian list and individual Mutation Khatian PDF verification.',
  },
  'mouza-map': {
    docType: 'MOUZA_MAP',
    titleEn: 'Mouza Map Sheet PDF',
    titleBn: 'মৌজা ম্যাপ PDF শিট',
    path: '/mouza-map',
    fullUrl: 'https://eporcha.tech/mouza-map',
    badgeBn: 'মৌজা ম্যাপ PDF',
    description:
      'Searches and downloads available Mouza Map sheets (মৌজা ম্যাপ PDF) by Mouza JL number and sheet number.',
  },
};

export const SURVEY_LABELS: Record<SurveyType, { labelEn: string; labelBn: string }> = {
  CS: { labelEn: 'CS (Cadastral Survey)', labelBn: 'সিএস (CS)' },
  SA: { labelEn: 'SA (State Acquisition)', labelBn: 'এসএ (SA)' },
  RS: { labelEn: 'RS (Revisional Survey)', labelBn: 'আরএস (RS)' },
  BS: { labelEn: 'BS / BRS (Bangladesh Survey)', labelBn: 'বিএস / বিআরএস (BS)' },
  MUTATION: { labelEn: 'Mutation / Namjari', labelBn: 'নামজারি (Mutation)' },
};

function createMouzaList(
  upazilaKey: string,
  entries: Array<{
    jlNo: string;
    nameEn: string;
    nameBn: string;
    unionEn: string;
    unionBn: string;
    khatians?: number;
    dags?: number;
  }>
): MouzaNode[] {
  return entries.map((e) => ({
    id: `mz-${upazilaKey}-${e.jlNo}-${e.nameEn.toLowerCase().replace(/[^a-z0-9]/g, '')}`,
    jlNo: e.jlNo,
    nameEn: e.nameEn,
    nameBn: e.nameBn,
    unionNameEn: e.unionEn,
    unionNameBn: e.unionBn,
    availableSurveys: ['CS', 'SA', 'RS', 'BS', 'MUTATION'],
    estimatedKhatians: e.khatians ?? 920,
    estimatedDags: e.dags ?? 2100,
    mapSheets: [1, 2],
  }));
}

export const GEO_HIERARCHY: DivisionNode[] = [
  {
    id: 'div-chittagong',
    nameEn: 'Chittagong',
    nameBn: 'চট্টগ্রাম বিভাগ',
    eporchaSlug: 'chattogram',
    districts: [
      {
        id: 'dist-brahmanbaria',
        code: '12',
        nameEn: 'Brahmanbaria',
        nameBn: 'ব্রাহ্মণবাড়িয়া',
        eporchaSlug: 'brahmanbaria',
        upazilas: [
          {
            id: 'upz-nabinagar',
            nameEn: 'Nabinagar',
            nameBn: 'নবীনগর',
            eporchaSlug: 'nabinagar',
            mouzas: createMouzaList('nabinagar', [
              {
                jlNo: '114',
                nameEn: 'Goalai',
                nameBn: 'গোয়ালী',
                unionEn: '20-No Kaitala South Union',
                unionBn: '২০নং কাইতলা দক্ষিণ ইউনিয়ন',
                khatians: 842,
                dags: 1920,
              },
              {
                jlNo: '115',
                nameEn: 'Kaitala',
                nameBn: 'কাইতলা',
                unionEn: '20-No Kaitala South Union',
                unionBn: '২০নং কাইতলা দক্ষিণ ইউনিয়ন',
                khatians: 1410,
                dags: 3180,
              },
              {
                jlNo: '116',
                nameEn: 'Noagaon',
                nameBn: 'নোয়াগাঁও',
                unionEn: '20-No Kaitala South Union',
                unionBn: '২০নং কাইতলা দক্ষিণ ইউনিয়ন',
                khatians: 625,
                dags: 1340,
              },
              {
                jlNo: '117',
                nameEn: 'Ramnagar',
                nameBn: 'রামনগর',
                unionEn: '20-No Kaitala South Union',
                unionBn: '২০নং কাইতলা দক্ষিণ ইউনিয়ন',
                khatians: 518,
                dags: 1120,
              },
              {
                jlNo: '101',
                nameEn: 'Nabinagar Sadar',
                nameBn: 'নবীনগর সদর',
                unionEn: 'Nabinagar Paurashava',
                unionBn: 'নবীনগর পৌরসভা',
                khatians: 1680,
                dags: 3450,
              },
              {
                jlNo: '102',
                nameEn: 'Alamnagar',
                nameBn: 'আলমনগর',
                unionEn: 'Nabinagar Paurashava',
                unionBn: 'নবীনগর পৌরসভা',
                khatians: 790,
                dags: 1510,
              },
              {
                jlNo: '103',
                nameEn: 'Narayanpur',
                nameBn: 'নারায়ণপুর',
                unionEn: 'Nabinagar Paurashava',
                unionBn: 'নবীনগর পৌরসভা',
                khatians: 930,
                dags: 1980,
              },
              {
                jlNo: '104',
                nameEn: 'Bholachong',
                nameBn: 'ভোলাচং',
                unionEn: 'Nabinagar West Union',
                unionBn: 'নবীনগর পশ্চিম ইউনিয়ন',
                khatians: 810,
                dags: 1740,
              },
              {
                jlNo: '105',
                nameEn: 'Balia',
                nameBn: 'বালিয়া',
                unionEn: 'Balia Union',
                unionBn: 'বালিয়া ইউনিয়ন',
                khatians: 960,
                dags: 2150,
              },
              {
                jlNo: '106',
                nameEn: 'Mehari',
                nameBn: 'মেহারী',
                unionEn: 'Mehari Union',
                unionBn: 'মেহারী ইউনিয়ন',
                khatians: 1120,
                dags: 2490,
              },
              {
                jlNo: '107',
                nameEn: 'Nilkhi',
                nameBn: 'নীলখী',
                unionEn: 'Jinodpur Union',
                unionBn: 'জিনোদপুর ইউনিয়ন',
                khatians: 740,
                dags: 1620,
              },
              {
                jlNo: '108',
                nameEn: 'Tilinagar',
                nameBn: 'তিলীনগর',
                unionEn: 'Kaitala North Union',
                unionBn: 'কাইতলা উত্তর ইউনিয়ন',
                khatians: 685,
                dags: 1490,
              },
              {
                jlNo: '109',
                nameEn: 'Kedarkhola',
                nameBn: 'কেদারখোলা',
                unionEn: 'Bitghar Union',
                unionBn: 'বিটঘর ইউনিয়ন',
                khatians: 640,
                dags: 1380,
              },
              {
                jlNo: '110',
                nameEn: 'Bitghar',
                nameBn: 'বিটঘর',
                unionEn: 'Bitghar Union',
                unionBn: 'বিটঘর ইউনিয়ন',
                khatians: 1290,
                dags: 2840,
              },
              {
                jlNo: '111',
                nameEn: 'Satmora',
                nameBn: 'সাতমোড়া',
                unionEn: 'Satmora Union',
                unionBn: 'সাতমোড়া ইউনিয়ন',
                khatians: 950,
                dags: 2110,
              },
              {
                jlNo: '112',
                nameEn: 'Rasullabad',
                nameBn: 'রসুল্লাবাদ',
                unionEn: 'Rasullabad Union',
                unionBn: 'রসুল্লাবাদ ইউনিয়ন',
                khatians: 1180,
                dags: 2630,
              },
              {
                jlNo: '113',
                nameEn: 'Salimganj',
                nameBn: 'সলিমগঞ্জ',
                unionEn: 'Salimganj Union',
                unionBn: 'সলিমগঞ্জ ইউনিয়ন',
                khatians: 1045,
                dags: 2290,
              },
              {
                jlNo: '118',
                nameEn: 'Shyamgram',
                nameBn: 'শ্যামগ্রাম',
                unionEn: 'Shyamgram Union',
                unionBn: 'শ্যামগ্রাম ইউনিয়ন',
                khatians: 1320,
                dags: 2890,
              },
              {
                jlNo: '119',
                nameEn: 'Boroikandi',
                nameBn: 'বড়িকান্দি',
                unionEn: 'Boroikandi Union',
                unionBn: 'বড়িকান্দি ইউনিয়ন',
                khatians: 890,
                dags: 1940,
              },
              {
                jlNo: '120',
                nameEn: 'Krishnanagar',
                nameBn: 'কৃষ্ণনগর',
                unionEn: 'Krishnanagar Union',
                unionBn: 'কৃষ্ণনগর ইউনিয়ন',
                khatians: 1080,
                dags: 2370,
              },
              {
                jlNo: '121',
                nameEn: 'Natghar',
                nameBn: 'নাটঘর',
                unionEn: 'Natghar Union',
                unionBn: 'নাটঘর ইউনিয়ন',
                khatians: 970,
                dags: 2120,
              },
              {
                jlNo: '122',
                nameEn: 'Ratanpur',
                nameBn: 'রতনপুর',
                unionEn: 'Ratanpur Union',
                unionBn: 'রতনপুর ইউনিয়ন',
                khatians: 880,
                dags: 1890,
              },
              {
                jlNo: '123',
                nameEn: 'Sreenagar',
                nameBn: 'শ্রীনগর',
                unionEn: 'Sreenagar Union',
                unionBn: 'শ্রীনগর ইউনিয়ন',
                khatians: 760,
                dags: 1680,
              },
              {
                jlNo: '124',
                nameEn: 'Vidyakut',
                nameBn: 'বিদ্যাকুট',
                unionEn: 'Vidyakut Union',
                unionBn: 'বিদ্যাকুট ইউনিয়ন',
                khatians: 1150,
                dags: 2540,
              },
            ]),
          },
          {
            id: 'upz-bb-sadar',
            nameEn: 'Brahmanbaria Sadar',
            nameBn: 'ব্রাহ্মণবাড়িয়া সদর',
            eporchaSlug: 'brahmanbaria-sadar',
            mouzas: createMouzaList('bbsadar', [
              {
                jlNo: '01',
                nameEn: 'Medda',
                nameBn: 'মেড্ডা',
                unionEn: 'Brahmanbaria Paurashava',
                unionBn: 'ব্রাহ্মণবাড়িয়া পৌরসভা',
              },
              {
                jlNo: '02',
                nameEn: 'Kazipara',
                nameBn: 'কাজীপাড়া',
                unionEn: 'Brahmanbaria Paurashava',
                unionBn: 'ব্রাহ্মণবাড়িয়া পৌরসভা',
              },
              {
                jlNo: '03',
                nameEn: 'Natai',
                nameBn: 'নাটাই',
                unionEn: 'Natai North Union',
                unionBn: 'নাটাই উত্তর ইউনিয়ন',
              },
              {
                jlNo: '04',
                nameEn: 'Suhilpur',
                nameBn: 'সুহিলপুর',
                unionEn: 'Suhilpur Union',
                unionBn: 'সুহিলপুর ইউনিয়ন',
              },
              {
                jlNo: '05',
                nameEn: 'Majlishpur',
                nameBn: 'মজলিশপুর',
                unionEn: 'Majlishpur Union',
                unionBn: 'মজলিশপুর ইউনিয়ন',
              },
              {
                jlNo: '06',
                nameEn: 'Budhal',
                nameBn: 'বুধল',
                unionEn: 'Budhal Union',
                unionBn: 'বুধল ইউনিয়ন',
              },
              {
                jlNo: '07',
                nameEn: 'Talshahar East',
                nameBn: 'তালশহর পূর্ব',
                unionEn: 'Talshahar East Union',
                unionBn: 'তালশহর পূর্ব ইউনিয়ন',
              },
              {
                jlNo: '08',
                nameEn: 'Ramrail',
                nameBn: 'রামরাইল',
                unionEn: 'Ramrail Union',
                unionBn: 'রামরাইল ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-kasba',
            nameEn: 'Kasba',
            nameBn: 'কসবা',
            eporchaSlug: 'kasba',
            mouzas: createMouzaList('kasba', [
              {
                jlNo: '10',
                nameEn: 'Kuti',
                nameBn: 'কুটি',
                unionEn: 'Kuti Union',
                unionBn: 'কুটি ইউনিয়ন',
              },
              {
                jlNo: '11',
                nameEn: 'Gopinathpur',
                nameBn: 'গোপীনাথপুর',
                unionEn: 'Gopinathpur Union',
                unionBn: 'গোপীনাথপুর ইউনিয়ন',
              },
              {
                jlNo: '12',
                nameEn: 'Kharera',
                nameBn: 'খাড়েরা',
                unionEn: 'Kharera Union',
                unionBn: 'খাড়েরা ইউনিয়ন',
              },
              {
                jlNo: '13',
                nameEn: 'mulgram',
                nameBn: 'মূলগ্রাম',
                unionEn: 'Mulgram Union',
                unionBn: 'মূলগ্রাম ইউনিয়ন',
              },
              {
                jlNo: '14',
                nameEn: 'Mehari Kasba',
                nameBn: 'মেহারী (কসবা)',
                unionEn: 'Mehari Union',
                unionBn: 'মেহারী ইউনিয়ন',
              },
              {
                jlNo: '15',
                nameEn: 'Badair',
                nameBn: 'বাদৈর',
                unionEn: 'Badair Union',
                unionBn: 'বাদৈর ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-ashuganj',
            nameEn: 'Ashuganj',
            nameBn: 'আশুগঞ্জ',
            eporchaSlug: 'ashuganj',
            mouzas: createMouzaList('ashuganj', [
              {
                jlNo: '01',
                nameEn: 'Char Chartala',
                nameBn: 'চর চারতলা',
                unionEn: 'Char Chartala Union',
                unionBn: 'চর চারতলা ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Durgapur',
                nameBn: 'দুর্গাপুর',
                unionEn: 'Durgapur Union',
                unionBn: 'দুর্গাপুর ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Talshahar West',
                nameBn: 'তালশহর পশ্চিম',
                unionEn: 'Talshahar West Union',
                unionBn: 'তালশহর পশ্চিম ইউনিয়ন',
              },
              {
                jlNo: '04',
                nameEn: 'Araisidha',
                nameBn: 'আড়াইসিধা',
                unionEn: 'Araisidha Union',
                unionBn: 'আড়াইসিধা ইউনিয়ন',
              },
              {
                jlNo: '05',
                nameEn: 'Lalpur',
                nameBn: 'লালপুর',
                unionEn: 'Lalpur Union',
                unionBn: 'লালপুর ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-sarail',
            nameEn: 'Sarail',
            nameBn: 'সরাইল',
            eporchaSlug: 'sarail',
            mouzas: createMouzaList('sarail', [
              {
                jlNo: '01',
                nameEn: 'Kutapara',
                nameBn: 'কুটাপাড়া',
                unionEn: 'Sarail Sadar Union',
                unionBn: 'সরাইল সদর ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Shahbazpur',
                nameBn: 'শাহবাজপুর',
                unionEn: 'Shahbazpur Union',
                unionBn: 'শাহবাজপুর ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Chunta',
                nameBn: 'চুণ্টা',
                unionEn: 'Chunta Union',
                unionBn: 'চুণ্টা ইউনিয়ন',
              },
              {
                jlNo: '04',
                nameEn: 'Kalikachha',
                nameBn: 'কালিকচ্ছ',
                unionEn: 'Kalikachha Union',
                unionBn: 'কালিকচ্ছ ইউনিয়ন',
              },
              {
                jlNo: '05',
                nameEn: 'Arifail',
                nameBn: 'আরিফাইল',
                unionEn: 'Sarail Sadar Union',
                unionBn: 'সরাইল সদর ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-nasirnagar',
            nameEn: 'Nasirnagar',
            nameBn: 'নাসিরনগর',
            eporchaSlug: 'nasirnagar',
            mouzas: createMouzaList('nasirnagar', [
              {
                jlNo: '01',
                nameEn: 'Gokarna',
                nameBn: 'গোকর্ণ',
                unionEn: 'Gokarna Union',
                unionBn: 'গোকর্ণ ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Fandauk',
                nameBn: 'ফান্দাউক',
                unionEn: 'Fandauk Union',
                unionBn: 'ফান্দাউক ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Kunda',
                nameBn: 'কুন্ডা',
                unionEn: 'Kunda Union',
                unionBn: 'কুন্ডা ইউনিয়ন',
              },
              {
                jlNo: '04',
                nameEn: 'Haripur',
                nameBn: 'হরিপুর',
                unionEn: 'Haripur Union',
                unionBn: 'হরিপুর ইউনিয়ন',
              },
              {
                jlNo: '05',
                nameEn: 'Guniak',
                nameBn: 'গুনিয়াক',
                unionEn: 'Guniak Union',
                unionBn: 'গুনিয়াক ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-akhaura',
            nameEn: 'Akhaura',
            nameBn: 'আখাউড়া',
            eporchaSlug: 'akhaura',
            mouzas: createMouzaList('akhaura', [
              {
                jlNo: '01',
                nameEn: 'Mogra',
                nameBn: 'মোগড়া',
                unionEn: 'Mogra Union',
                unionBn: 'মোগড়া ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Maniyand',
                nameBn: 'মনিয়ন্দ',
                unionEn: 'Maniyand Union',
                unionBn: 'মনিয়ন্দ ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Dharakhar',
                nameBn: 'ধরখার',
                unionEn: 'Dharakhar Union',
                unionBn: 'ধরখার ইউনিয়ন',
              },
              {
                jlNo: '04',
                nameEn: 'Radhanagar',
                nameBn: 'রাধানগর',
                unionEn: 'Akhaura Paurashava',
                unionBn: 'আখাউড়া পৌরসভা',
              },
            ]),
          },
          {
            id: 'upz-bancharampur',
            nameEn: 'Bancharampur',
            nameBn: 'বাঞ্ছারামপুর',
            eporchaSlug: 'bancharampur',
            mouzas: createMouzaList('bancharampur', [
              {
                jlNo: '01',
                nameEn: 'Ujanchar',
                nameBn: 'উজানচর',
                unionEn: 'Ujanchar Union',
                unionBn: 'উজানচর ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Paharia Kandi',
                nameBn: 'পাহাড়িয়াকান্দি',
                unionEn: 'Paharia Kandi Union',
                unionBn: 'পাহাড়িয়াকান্দি ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Sonarampur',
                nameBn: 'সোনারামপুর',
                unionEn: 'Sonarampur Union',
                unionBn: 'সোনারামপুর ইউনিয়ন',
              },
              {
                jlNo: '04',
                nameEn: 'Rupasdi',
                nameBn: 'রূপসদী',
                unionEn: 'Rupasdi Union',
                unionBn: 'রূপসদী ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-bijoynagar',
            nameEn: 'Bijoynagar',
            nameBn: 'বিজয়নগর',
            eporchaSlug: 'bijoynagar',
            mouzas: createMouzaList('bijoynagar', [
              {
                jlNo: '01',
                nameEn: 'Champaknagar',
                nameBn: 'চম্পকনগর',
                unionEn: 'Champaknagar Union',
                unionBn: 'চম্পকনগর ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Pattan',
                nameBn: 'পত্তন',
                unionEn: 'Pattan Union',
                unionBn: 'পত্তন ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Singarbil',
                nameBn: 'সিঙ্গারবিল',
                unionEn: 'Singarbil Union',
                unionBn: 'সিঙ্গারবিল ইউনিয়ন',
              },
              {
                jlNo: '04',
                nameEn: 'Bishnupur',
                nameBn: 'বিষ্ণুপুর',
                unionEn: 'Bishnupur Union',
                unionBn: 'বিষ্ণুপুর ইউনিয়ন',
              },
            ]),
          },
        ],
      },
      {
        id: 'dist-cumilla',
        code: '19',
        nameEn: 'Cumilla',
        nameBn: 'কুমিল্লা',
        eporchaSlug: 'cumilla',
        upazilas: [
          {
            id: 'upz-muradnagar',
            nameEn: 'Muradnagar',
            nameBn: 'মুরাদনগর',
            eporchaSlug: 'muradnagar',
            mouzas: createMouzaList('muradnagar', [
              {
                jlNo: '01',
                nameEn: 'Companyganj',
                nameBn: 'কোম্পানীগঞ্জ',
                unionEn: 'Muradnagar Sadar Union',
                unionBn: 'মুরাদনগর সদর ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Bangora',
                nameBn: 'বাঙ্গরা',
                unionEn: 'Bangora East Union',
                unionBn: 'বাঙ্গরা পূর্ব ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Sreekail',
                nameBn: 'শ্রীকাইল',
                unionEn: 'Sreekail Union',
                unionBn: 'শ্রীকাইল ইউনিয়ন',
              },
              {
                jlNo: '04',
                nameEn: 'Kamalla',
                nameBn: 'কামাল্লা',
                unionEn: 'Kamalla Union',
                unionBn: 'কামাল্লা ইউনিয়ন',
              },
              {
                jlNo: '05',
                nameEn: 'Jatrapur',
                nameBn: 'যাত্রাপুর',
                unionEn: 'Jatrapur Union',
                unionBn: 'যাত্রাপুর ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-debidwar',
            nameEn: 'Debidwar',
            nameBn: 'দেবিদ্বার',
            eporchaSlug: 'debidwar',
            mouzas: createMouzaList('debidwar', [
              {
                jlNo: '01',
                nameEn: 'Debidwar Sadar',
                nameBn: 'দেবিদ্বার সদর',
                unionEn: 'Debidwar Paurashava',
                unionBn: 'দেবিদ্বার পৌরসভা',
              },
              {
                jlNo: '02',
                nameEn: 'Jafarganj',
                nameBn: 'জাফরগঞ্জ',
                unionEn: 'Jafarganj Union',
                unionBn: 'জাফরগঞ্জ ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Elahabad',
                nameBn: 'এলাহাবাদ',
                unionEn: 'Elahabad Union',
                unionBn: 'এলাহাবাদ ইউনিয়ন',
              },
              {
                jlNo: '04',
                nameEn: 'Rajamehar',
                nameBn: 'রাজামেহার',
                unionEn: 'Rajamehar Union',
                unionBn: 'রাজামেহার ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-brahmanpara',
            nameEn: 'Brahmanpara',
            nameBn: 'ব্রাহ্মণপাড়া',
            eporchaSlug: 'brahmanpara',
            mouzas: createMouzaList('brahmanpara', [
              {
                jlNo: '01',
                nameEn: 'Shashidal',
                nameBn: 'শশীদল',
                unionEn: 'Shashidal Union',
                unionBn: 'শশীদল ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Madhabpur',
                nameBn: 'মাধবপুর',
                unionEn: 'Madhabpur Union',
                unionBn: 'মাধবপুর ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Shidlai',
                nameBn: 'শিদলাই',
                unionEn: 'Shidlai Union',
                unionBn: 'শিদলাই ইউনিয়ন',
              },
              {
                jlNo: '04',
                nameEn: 'Chandla',
                nameBn: 'চান্দলা',
                unionEn: 'Chandla Union',
                unionBn: 'চান্দলা ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-burichang',
            nameEn: 'Burichang',
            nameBn: 'বুড়িচং',
            eporchaSlug: 'burichang',
            mouzas: createMouzaList('burichang', [
              {
                jlNo: '01',
                nameEn: 'Mainamati',
                nameBn: 'ময়নামতি',
                unionEn: 'Mainamati Union',
                unionBn: 'ময়নামতি ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Rajapur',
                nameBn: 'রাজাপুর',
                unionEn: 'Rajapur Union',
                unionBn: 'রাজাপুর ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Bakshimul',
                nameBn: 'বাকশীমূল',
                unionEn: 'Bakshimul Union',
                unionBn: 'বাকশীমূল ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-cumilla-sadar',
            nameEn: 'Cumilla Adarsha Sadar',
            nameBn: 'কুমিল্লা আদর্শ সদর',
            eporchaSlug: 'cumilla-adarsha-sadar',
            mouzas: createMouzaList('cumillasadar', [
              {
                jlNo: '01',
                nameEn: 'Kandirpar',
                nameBn: 'কান্দিরপাড়',
                unionEn: 'Cumilla City Corp',
                unionBn: 'কুমিল্লা সিটি কর্পোরেশন',
              },
              {
                jlNo: '02',
                nameEn: 'Durgapur North',
                nameBn: 'দুর্গাপুর উত্তর',
                unionEn: 'Durgapur North Union',
                unionBn: 'দুর্গাপুর উত্তর ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Amratali',
                nameBn: 'আমড়াতলী',
                unionEn: 'Amratali Union',
                unionBn: 'আমড়াতলী ইউনিয়ন',
              },
              {
                jlNo: '04',
                nameEn: 'Kalirbazar',
                nameBn: 'কালিরবাজার',
                unionEn: 'Kalirbazar Union',
                unionBn: 'কালিরবাজার ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-daudkandi',
            nameEn: 'Daudkandi',
            nameBn: 'দাউদকান্দি',
            eporchaSlug: 'daudkandi',
            mouzas: createMouzaList('daudkandi', [
              {
                jlNo: '01',
                nameEn: 'Gouripur',
                nameBn: 'গৌরীপুর',
                unionEn: 'Gouripur Union',
                unionBn: 'গৌরীপুর ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Eliotganj',
                nameBn: 'ইলিয়টগঞ্জ',
                unionEn: 'Eliotganj North Union',
                unionBn: 'ইলিয়টগঞ্জ উত্তর ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'hasanpur',
                nameBn: 'হাসানপুর',
                unionEn: 'Daudkandi Paurashava',
                unionBn: 'দাউদকান্দি পৌরসভা',
              },
            ]),
          },
          {
            id: 'upz-homna',
            nameEn: 'Homna',
            nameBn: 'হোমনা',
            eporchaSlug: 'homna',
            mouzas: createMouzaList('homna', [
              {
                jlNo: '01',
                nameEn: 'Homna Sadar',
                nameBn: 'হোমনা সদর',
                unionEn: 'Homna Paurashava',
                unionBn: 'হোমনা পৌরসভা',
              },
              {
                jlNo: '02',
                nameEn: 'Asadpur',
                nameBn: 'আসাদপুর',
                unionEn: 'Asadpur Union',
                unionBn: 'আসাদপুর ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Dulalpur',
                nameBn: 'দুলালপুর',
                unionEn: 'Dulalpur Union',
                unionBn: 'দুলালপুর ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-chandina',
            nameEn: 'Chandina',
            nameBn: 'চান্দিনা',
            eporchaSlug: 'chandina',
            mouzas: createMouzaList('chandina', [
              {
                jlNo: '01',
                nameEn: 'Madhaiya',
                nameBn: 'মাধাইয়া',
                unionEn: 'Madhaiya Union',
                unionBn: 'মাধাইয়া ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Belashahar',
                nameBn: 'বেলাশহর',
                unionEn: 'Chandina Paurashava',
                unionBn: 'চান্দিনা পৌরসভা',
              },
              {
                jlNo: '03',
                nameEn: 'Barkait',
                nameBn: 'বরকইট',
                unionEn: 'Barkait Union',
                unionBn: 'বরকইট ইউনিয়ন',
              },
            ]),
          },
        ],
      },
      {
        id: 'dist-chattogram',
        code: '15',
        nameEn: 'Chattogram',
        nameBn: 'চট্টগ্রাম',
        eporchaSlug: 'chattogram',
        upazilas: [
          {
            id: 'upz-hathazari',
            nameEn: 'Hathazari',
            nameBn: 'হাটহাজারী',
            eporchaSlug: 'hathazari',
            mouzas: createMouzaList('hathazari', [
              {
                jlNo: '01',
                nameEn: 'Fatehpur',
                nameBn: 'ফতেপুর',
                unionEn: 'Fatehpur Union',
                unionBn: 'ফতেপুর ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Chikandandi',
                nameBn: 'চিকনদণ্ডী',
                unionEn: 'Chikandandi Union',
                unionBn: 'চিকনদণ্ডী ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Madrasa',
                nameBn: 'মাদ্রাসা',
                unionEn: 'Madrasa Union',
                unionBn: 'মাদ্রাসা ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-sitakunda',
            nameEn: 'Sitakunda',
            nameBn: 'সীতাকুণ্ড',
            eporchaSlug: 'sitakunda',
            mouzas: createMouzaList('sitakunda', [
              {
                jlNo: '01',
                nameEn: 'Kumira',
                nameBn: 'কুমিরা',
                unionEn: 'Kumira Union',
                unionBn: 'কুমিরা ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Bhatiari',
                nameBn: 'ভাটিয়ারী',
                unionEn: 'Bhatiari Union',
                unionBn: 'ভাটিয়ারী ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Barabkunda',
                nameBn: 'বাড়বকুণ্ড',
                unionEn: 'Barabkunda Union',
                unionBn: 'বাড়বকুণ্ড ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-patiya',
            nameEn: 'Patiya',
            nameBn: 'পটিয়া',
            eporchaSlug: 'patiya',
            mouzas: createMouzaList('patiya', [
              {
                jlNo: '01',
                nameEn: 'Habilasdwip',
                nameBn: 'হাবিলাসদ্বীপ',
                unionEn: 'Habilasdwip Union',
                unionBn: 'হাবিলাসদ্বীপ ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Kachuai',
                nameBn: 'কচুয়াই',
                unionEn: 'Kachuai Union',
                unionBn: 'কচুয়াই ইউনিয়ন',
              },
            ]),
          },
        ],
      },
      {
        id: 'dist-noakhali',
        code: '75',
        nameEn: 'Noakhali',
        nameBn: 'নোয়াখালী',
        eporchaSlug: 'noakhali',
        upazilas: [
          {
            id: 'upz-begumganj',
            nameEn: 'Begumganj',
            nameBn: 'বেগমগঞ্জ',
            eporchaSlug: 'begumganj',
            mouzas: createMouzaList('begumganj', [
              {
                jlNo: '01',
                nameEn: 'Choumohani',
                nameBn: 'চৌমুহনী',
                unionEn: 'Choumohani Paurashava',
                unionBn: 'চৌমুহনী পৌরসভা',
              },
              {
                jlNo: '02',
                nameEn: 'Eklashpur',
                nameBn: 'একলাশপুর',
                unionEn: 'Eklashpur Union',
                unionBn: 'একলাশপুর ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Rajganj',
                nameBn: 'রাজগঞ্জ',
                unionEn: 'Rajganj Union',
                unionBn: 'রাজগঞ্জ ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-noakhali-sadar',
            nameEn: 'Noakhali Sadar (Sudharam)',
            nameBn: 'নোয়াখালী সদর (সুধারাম)',
            eporchaSlug: 'noakhali-sadar',
            mouzas: createMouzaList('noakhalisadar', [
              {
                jlNo: '01',
                nameEn: 'Maijdee',
                nameBn: 'মাইজদী',
                unionEn: 'Noakhali Paurashava',
                unionBn: 'নোয়াখালী পৌরসভা',
              },
              {
                jlNo: '02',
                nameEn: 'Binodpur',
                nameBn: 'বিনোদপুর',
                unionEn: 'Binodpur Union',
                unionBn: 'বিনোদপুর ইউনিয়ন',
              },
            ]),
          },
        ],
      },
      {
        id: 'dist-feni',
        code: '30',
        nameEn: 'Feni',
        nameBn: 'ফেনী',
        eporchaSlug: 'feni',
        upazilas: [
          {
            id: 'upz-feni-sadar',
            nameEn: 'Feni Sadar',
            nameBn: 'ফেনী সদর',
            eporchaSlug: 'feni-sadar',
            mouzas: createMouzaList('fenisadar', [
              {
                jlNo: '01',
                nameEn: 'Rampur',
                nameBn: 'রামপুর',
                unionEn: 'Feni Paurashava',
                unionBn: 'ফেনী পৌরসভা',
              },
              {
                jlNo: '02',
                nameEn: 'Lemua',
                nameBn: 'লেমুয়া',
                unionEn: 'Lemua Union',
                unionBn: 'লেমুয়া ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Chhagalnaiya Road',
                nameBn: 'পাঁচগাছিয়া',
                unionEn: 'Panchgachhia Union',
                unionBn: 'পাঁচগাছিয়া ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-daganbhuiyan',
            nameEn: 'Daganbhuiyan',
            nameBn: 'দাগনভূঞা',
            eporchaSlug: 'daganbhuiyan',
            mouzas: createMouzaList('daganbhuiyan', [
              {
                jlNo: '01',
                nameEn: 'Sindurpur',
                nameBn: 'সিন্দুরপুর',
                unionEn: 'Sindurpur Union',
                unionBn: 'সিন্দুরপুর ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Rajapur Feni',
                nameBn: 'রাজাপুর',
                unionEn: 'Rajapur Union',
                unionBn: 'রাজাপুর ইউনিয়ন',
              },
            ]),
          },
        ],
      },
      {
        id: 'dist-chandpur',
        code: '13',
        nameEn: 'Chandpur',
        nameBn: 'চাঁদপুর',
        eporchaSlug: 'chandpur',
        upazilas: [
          {
            id: 'upz-kachua',
            nameEn: 'Kachua',
            nameBn: 'কচুয়া',
            eporchaSlug: 'kachua',
            mouzas: createMouzaList('kachua', [
              {
                jlNo: '01',
                nameEn: 'Sachar',
                nameBn: 'সাচার',
                unionEn: 'Sachar Union',
                unionBn: 'সাচার ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Rahimanagar',
                nameBn: 'রহিমানগর',
                unionEn: 'Kachua South Union',
                unionBn: 'কচুয়া দক্ষিণ ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-hajiganj',
            nameEn: 'Hajiganj',
            nameBn: 'হাজীগঞ্জ',
            eporchaSlug: 'hajiganj',
            mouzas: createMouzaList('hajiganj', [
              {
                jlNo: '01',
                nameEn: 'Hajiganj Bazar',
                nameBn: 'হাজীগঞ্জ বাজার',
                unionEn: 'Hajiganj Paurashava',
                unionBn: 'হাজীগঞ্জ পৌরসভা',
              },
              {
                jlNo: '02',
                nameEn: 'Bakila',
                nameBn: 'বাকিলা',
                unionEn: 'Bakila Union',
                unionBn: 'বাকিলা ইউনিয়ন',
              },
            ]),
          },
        ],
      },
    ],
  },
  {
    id: 'div-dhaka',
    nameEn: 'Dhaka',
    nameBn: 'ঢাকা বিভাগ',
    eporchaSlug: 'dhaka',
    districts: [
      {
        id: 'dist-dhaka',
        code: '26',
        nameEn: 'Dhaka',
        nameBn: 'ঢাকা',
        eporchaSlug: 'dhaka',
        upazilas: [
          {
            id: 'upz-savar',
            nameEn: 'Savar',
            nameBn: 'সাভার',
            eporchaSlug: 'savar',
            mouzas: createMouzaList('savar', [
              {
                jlNo: '01',
                nameEn: 'Ashulia',
                nameBn: 'আশুলিয়া',
                unionEn: 'Ashulia Union',
                unionBn: 'আশুলিয়া ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Birulia',
                nameBn: 'বিরুলিয়া',
                unionEn: 'Birulia Union',
                unionBn: 'বিরুলিয়া ইউনিয়ন',
              },
              {
                jlNo: '03',
                nameEn: 'Tetuljhora',
                nameBn: 'তেঁতুলঝোড়া',
                unionEn: 'Tetuljhora Union',
                unionBn: 'তেঁতুলঝোড়া ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-dhamrai',
            nameEn: 'Dhamrai',
            nameBn: 'ধামরাই',
            eporchaSlug: 'dhamrai',
            mouzas: createMouzaList('dhamrai', [
              {
                jlNo: '01',
                nameEn: 'Islampur',
                nameBn: 'ইসলামপুর',
                unionEn: 'Dhamrai Paurashava',
                unionBn: 'ধামরাই পৌরসভা',
              },
              {
                jlNo: '02',
                nameEn: 'Kulla',
                nameBn: 'কুল্লা',
                unionEn: 'Kulla Union',
                unionBn: 'কুল্লা ইউনিয়ন',
              },
            ]),
          },
        ],
      },
      {
        id: 'dist-narayanganj',
        code: '67',
        nameEn: 'Narayanganj',
        nameBn: 'নারায়ণগঞ্জ',
        eporchaSlug: 'narayanganj',
        upazilas: [
          {
            id: 'upz-sonargaon',
            nameEn: 'Sonargaon',
            nameBn: 'সোনারগাঁও',
            eporchaSlug: 'sonargaon',
            mouzas: createMouzaList('sonargaon', [
              {
                jlNo: '01',
                nameEn: 'Mograpara',
                nameBn: 'মোগরাপাড়া',
                unionEn: 'Mograpara Union',
                unionBn: 'মোগরাপাড়া ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Kanchpur',
                nameBn: 'কাঁচপুর',
                unionEn: 'Kanchpur Union',
                unionBn: 'কাঁচপুর ইউনিয়ন',
              },
            ]),
          },
          {
            id: 'upz-rupganj',
            nameEn: 'Rupganj',
            nameBn: 'রূপগঞ্জ',
            eporchaSlug: 'rupganj',
            mouzas: createMouzaList('rupganj', [
              {
                jlNo: '01',
                nameEn: 'Murapara',
                nameBn: 'মুড়াপাড়া',
                unionEn: 'Murapara Union',
                unionBn: 'মুড়াপাড়া ইউনিয়ন',
              },
              {
                jlNo: '02',
                nameEn: 'Bhulta',
                nameBn: 'ভূলতা',
                unionEn: 'Bhulta Union',
                unionBn: 'ভূলতা ইউনিয়ন',
              },
            ]),
          },
        ],
      },
    ],
  },
];

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

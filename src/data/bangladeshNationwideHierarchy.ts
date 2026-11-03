import { DivisionNode } from '../types/land';

/**
 * Authoritative Nationwide Geographic Hierarchy (Preloaded Baseline).
 * Contains all 8 divisions and 64 districts of Bangladesh to ensure
 * instant UI responsiveness ("pre-faced and preloaded").
 * Upazilas and Mouzas are discovered live or through the verified database
 * to ensure provenance and accuracy.
 */
export const BANGLADESH_NATIONWIDE_HIERARCHY: DivisionNode[] = [
  {
    id: 'div-1',
    nameEn: 'Chattogram',
    nameBn: 'চট্টগ্রাম',
    eporchaSlug: 'chattogram',
    districts: [
      { 
        id: 'dist-12', 
        code: '12', 
        nameEn: 'Brahmanbaria', 
        nameBn: 'ব্রাহ্মণবাড়িয়া', 
        eporchaSlug: 'brahmanbaria', 
        upazilas: [
          { id: 'upz-101', nameEn: 'Nabinagar', nameBn: 'নবীনগর', eporchaSlug: 'nabinagar', mouzas: [] },
          { id: 'upz-102', nameEn: 'Brahmanbaria Sadar', nameBn: 'ব্রাহ্মণবাড়িয়া সদর', eporchaSlug: 'brahmanbaria-sadar', mouzas: [] },
          { id: 'upz-103', nameEn: 'Kasba', nameBn: 'কসবা', eporchaSlug: 'kasba', mouzas: [] },
          { id: 'upz-104', nameEn: 'Ashuganj', nameBn: 'আশুগঞ্জ', eporchaSlug: 'ashuganj', mouzas: [] },
          { id: 'upz-105', nameEn: 'Sarail', nameBn: 'সরাইল', eporchaSlug: 'sarail', mouzas: [] },
          { id: 'upz-106', nameEn: 'Nasirnagar', nameBn: 'নাসিরনগর', eporchaSlug: 'nasirnagar', mouzas: [] },
          { id: 'upz-107', nameEn: 'Akhaura', nameBn: 'আখাউড়া', eporchaSlug: 'akhaura', mouzas: [] },
          { id: 'upz-108', nameEn: 'Bancharampur', nameBn: 'বাঞ্ছারামপুর', eporchaSlug: 'bancharampur', mouzas: [] },
          { id: 'upz-109', nameEn: 'Bijoynagar', nameBn: 'বিজয়নগর', eporchaSlug: 'bijoynagar', mouzas: [] },
        ] 
      },
      { 
        id: 'dist-19', 
        code: '19', 
        nameEn: 'Cumilla', 
        nameBn: 'কুমিল্লা', 
        eporchaSlug: 'cumilla', 
        upazilas: [
          { id: 'upz-201', nameEn: 'Muradnagar', nameBn: 'মুরাদনগর', eporchaSlug: 'muradnagar', mouzas: [] },
          { id: 'upz-202', nameEn: 'Debidwar', nameBn: 'দেবিদ্বার', eporchaSlug: 'debidwar', mouzas: [] },
          { id: 'upz-203', nameEn: 'Brahmanpara', nameBn: 'ব্রাহ্মণপাড়া', eporchaSlug: 'brahmanpara', mouzas: [] },
        ] 
      },
      { id: 'dist-13', code: '13', nameEn: 'Chandpur', nameBn: 'চাঁদপুর', eporchaSlug: 'chandpur', upazilas: [] },
      { id: 'dist-11', code: '11', nameEn: 'Bandarban', nameBn: 'বান্দরবান', eporchaSlug: 'bandarban', upazilas: [] },
      { id: 'dist-15', code: '15', nameEn: 'Cox\'s Bazar', nameBn: 'কক্সবাজার', eporchaSlug: 'coxs-bazar', upazilas: [] },
      { id: 'dist-16', code: '16', nameEn: 'Feni', nameBn: 'ফেনী', eporchaSlug: 'feni', upazilas: [] },
      { id: 'dist-17', code: '17', nameEn: 'Khagrachhari', nameBn: 'খাগড়াছড়ি', eporchaSlug: 'khagrachhari', upazilas: [] },
      { id: 'dist-18', code: '18', nameEn: 'Lakshmipur', nameBn: 'লক্ষ্মীপুর', eporchaSlug: 'lakshmipur', upazilas: [] },
      { id: 'dist-20', code: '20', nameEn: 'Noakhali', nameBn: 'নোয়াখালী', eporchaSlug: 'noakhali', upazilas: [] },
      { id: 'dist-21', code: '21', nameEn: 'Rangamati', nameBn: 'রাঙামাটি', eporchaSlug: 'rangamati', upazilas: [] },
      { id: 'dist-14', code: '14', nameEn: 'Chattogram', nameBn: 'চট্টগ্রাম', eporchaSlug: 'chattogram', upazilas: [] },
    ],
  },
  {
    id: 'div-2',
    nameEn: 'Dhaka',
    nameBn: 'ঢাকা',
    eporchaSlug: 'dhaka',
    districts: [
      { id: 'dist-26', code: '26', nameEn: 'Dhaka', nameBn: 'ঢাকা', eporchaSlug: 'dhaka', upazilas: [] },
      { id: 'dist-25', code: '25', nameEn: 'Gazipur', nameBn: 'গাজীপুর', eporchaSlug: 'gazipur', upazilas: [] },
      { id: 'dist-29', code: '29', nameEn: 'Manikganj', nameBn: 'মানিকগঞ্জ', eporchaSlug: 'manikganj', upazilas: [] },
      { id: 'dist-30', code: '30', nameEn: 'Munshiganj', nameBn: 'মুন্সীগঞ্জ', eporchaSlug: 'munshiganj', upazilas: [] },
      { id: 'dist-31', code: '31', nameEn: 'Narayanganj', nameBn: 'নারায়ণগঞ্জ', eporchaSlug: 'narayanganj', upazilas: [] },
      { id: 'dist-32', code: '32', nameEn: 'Narsingdi', nameBn: 'নরসিংদী', eporchaSlug: 'narsingdi', upazilas: [] },
      { id: 'dist-23', code: '23', nameEn: 'Faridpur', nameBn: 'ফরিদপুর', eporchaSlug: 'faridpur', upazilas: [] },
      { id: 'dist-24', code: '24', nameEn: 'Gopalganj', nameBn: 'গোপালগঞ্জ', eporchaSlug: 'gopalganj', upazilas: [] },
      { id: 'dist-27', code: '27', nameEn: 'Kishoreganj', nameBn: 'কিশোরগঞ্জ', eporchaSlug: 'kishoreganj', upazilas: [] },
      { id: 'dist-28', code: '28', nameEn: 'Madaripur', nameBn: 'মাদারীপুর', eporchaSlug: 'madaripur', upazilas: [] },
      { id: 'dist-33', code: '33', nameEn: 'Rajbari', nameBn: 'রাজবাড়ী', eporchaSlug: 'rajbari', upazilas: [] },
      { id: 'dist-34', code: '34', nameEn: 'Shariatpur', nameBn: 'শরীয়তপুর', eporchaSlug: 'shariatpur', upazilas: [] },
      { id: 'dist-22', code: '22', nameEn: 'Tangail', nameBn: 'টাঙ্গাইল', eporchaSlug: 'tangail', upazilas: [] },
    ],
  },
  {
    id: 'div-3',
    nameEn: 'Rajshahi',
    nameBn: 'রাজশাহী',
    eporchaSlug: 'rajshahi',
    districts: [
      { id: 'dist-54', code: '54', nameEn: 'Rajshahi', nameBn: 'রাজশাহী', eporchaSlug: 'rajshahi', upazilas: [] },
      { id: 'dist-48', code: '48', nameEn: 'Bogra', nameBn: 'বগুড়া', eporchaSlug: 'bogra', upazilas: [] },
      { id: 'dist-49', code: '49', nameEn: 'Joypurhat', nameBn: 'জয়পুরহাট', eporchaSlug: 'joypurhat', upazilas: [] },
      { id: 'dist-50', code: '50', nameEn: 'Naogaon', nameBn: 'নওগাঁ', eporchaSlug: 'naogaon', upazilas: [] },
      { id: 'dist-51', code: '51', nameEn: 'Natore', nameBn: 'নাটোর', eporchaSlug: 'natore', upazilas: [] },
      { id: 'dist-52', code: '52', nameEn: 'Chapai Nawabganj', nameBn: 'চাঁপাইনবাবগঞ্জ', eporchaSlug: 'chapai-nawabganj', upazilas: [] },
      { id: 'dist-53', code: '53', nameEn: 'Pabna', nameBn: 'পাবনা', eporchaSlug: 'pabna', upazilas: [] },
      { id: 'dist-55', code: '55', nameEn: 'Sirajganj', nameBn: 'সিরাজগঞ্জ', eporchaSlug: 'sirajganj', upazilas: [] },
    ],
  },
  {
    id: 'div-4',
    nameEn: 'Khulna',
    nameBn: 'খুলনা',
    eporchaSlug: 'khulna',
    districts: [
      { id: 'dist-41', code: '41', nameEn: 'Khulna', nameBn: 'খুলনা', eporchaSlug: 'khulna', upazilas: [] },
      { id: 'dist-38', code: '38', nameEn: 'Bagerhat', nameBn: 'বাগেরহাট', eporchaSlug: 'bagerhat', upazilas: [] },
      { id: 'dist-39', code: '39', nameEn: 'Chuadanga', nameBn: 'চুয়াডাঙ্গা', eporchaSlug: 'chuadanga', upazilas: [] },
      { id: 'dist-40', code: '40', nameEn: 'Jashore', nameBn: 'যশোর', eporchaSlug: 'jashore', upazilas: [] },
      { id: 'dist-42', code: '42', nameEn: 'Kushtia', nameBn: 'কুষ্টিয়া', eporchaSlug: 'kushtia', upazilas: [] },
      { id: 'dist-43', code: '43', nameEn: 'Magura', nameBn: 'মাগুরা', eporchaSlug: 'magura', upazilas: [] },
      { id: 'dist-44', code: '44', nameEn: 'Meherpur', nameBn: 'মেহেরপুর', eporchaSlug: 'meherpur', upazilas: [] },
      { id: 'dist-45', code: '45', nameEn: 'Narail', nameBn: 'নড়াইল', eporchaSlug: 'narail', upazilas: [] },
      { id: 'dist-46', code: '46', nameEn: 'Satkhira', nameBn: 'সাতক্ষীরা', eporchaSlug: 'satkhira', upazilas: [] },
      { id: 'dist-47', code: '47', nameEn: 'Jhenaidah', nameBn: 'ঝিনাইদহ', eporchaSlug: 'jhenaidah', upazilas: [] },
    ],
  },
  {
    id: 'div-5',
    nameEn: 'Barishal',
    nameBn: 'বরিশাল',
    eporchaSlug: 'barishal',
    districts: [
      { id: 'dist-6', code: '06', nameEn: 'Barishal', nameBn: 'বরিশাল', eporchaSlug: 'barishal', upazilas: [] },
      { id: 'dist-7', code: '07', nameEn: 'Bhola', nameBn: 'ভোলা', eporchaSlug: 'bhola', upazilas: [] },
      { id: 'dist-8', code: '08', nameEn: 'Jhalokathi', nameBn: 'ঝালকাঠি', eporchaSlug: 'jhalokathi', upazilas: [] },
      { id: 'dist-9', code: '09', nameEn: 'Patuakhali', nameBn: 'পটুয়াখালী', eporchaSlug: 'patuakhali', upazilas: [] },
      { id: 'dist-10', code: '10', nameEn: 'Pirojpur', nameBn: 'পিরোজপুর', eporchaSlug: 'pirojpur', upazilas: [] },
      { id: 'dist-5', code: '05', nameEn: 'Barguna', nameBn: 'বরগুনা', eporchaSlug: 'barguna', upazilas: [] },
    ],
  },
  {
    id: 'div-6',
    nameEn: 'Sylhet',
    nameBn: 'সিলেট',
    eporchaSlug: 'sylhet',
    districts: [
      { id: 'dist-60', code: '60', nameEn: 'Sylhet', nameBn: 'সিলেট', eporchaSlug: 'sylhet', upazilas: [] },
      { id: 'dist-58', code: '58', nameEn: 'Habiganj', nameBn: 'হবিগঞ্জ', eporchaSlug: 'habiganj', upazilas: [] },
      { id: 'dist-59', code: '59', nameEn: 'Moulvibazar', nameBn: 'মৌলভীবাজার', eporchaSlug: 'moulvibazar', upazilas: [] },
      { id: 'dist-61', code: '61', nameEn: 'Sunamganj', nameBn: 'সুনামগঞ্জ', eporchaSlug: 'sunamganj', upazilas: [] },
    ],
  },
  {
    id: 'div-7',
    nameEn: 'Rangpur',
    nameBn: 'রংপুর',
    eporchaSlug: 'rangpur',
    districts: [
      { id: 'dist-56', code: '56', nameEn: 'Rangpur', nameBn: 'রংপুর', eporchaSlug: 'rangpur', upazilas: [] },
      { id: 'dist-62', code: '62', nameEn: 'Dinajpur', nameBn: 'দিনাজপুর', eporchaSlug: 'dinajpur', upazilas: [] },
      { id: 'dist-63', code: '63', nameEn: 'Gaibandha', nameBn: 'গাইবান্ধা', eporchaSlug: 'gaibandha', upazilas: [] },
      { id: 'dist-64', code: '64', nameEn: 'Kurigram', nameBn: 'কুড়িগ্রাম', eporchaSlug: 'kurigram', upazilas: [] },
      { id: 'dist-65', code: '65', nameEn: 'Lalmonirhat', nameBn: 'লালমনিরহাট', eporchaSlug: 'lalmonirhat', upazilas: [] },
      { id: 'dist-66', code: '66', nameEn: 'Nilphamari', nameBn: 'নীলফামারী', eporchaSlug: 'nilphamari', upazilas: [] },
      { id: 'dist-67', code: '67', nameEn: 'Panchagarh', nameBn: 'পঞ্চগড়', eporchaSlug: 'panchagarh', upazilas: [] },
      { id: 'dist-68', code: '68', nameEn: 'Thakurgaon', nameBn: 'ঠাকুরগাঁও', eporchaSlug: 'thakurgaon', upazilas: [] },
    ],
  },
  {
    id: 'div-8',
    nameEn: 'Mymensingh',
    nameBn: 'ময়মনসিংহ',
    eporchaSlug: 'mymensingh',
    districts: [
      { id: 'dist-35', code: '35', nameEn: 'Mymensingh', nameBn: 'ময়মনসিংহ', eporchaSlug: 'mymensingh', upazilas: [] },
      { id: 'dist-36', code: '36', nameEn: 'Jamalpur', nameBn: 'জামালপুর', eporchaSlug: 'jamalpur', upazilas: [] },
      { id: 'dist-37', code: '37', nameEn: 'Netrokona', nameBn: 'নেত্রকোণা', eporchaSlug: 'netrokona', upazilas: [] },
      { id: 'dist-38-m', code: '38', nameEn: 'Sherpur', nameBn: 'শেরপুর', eporchaSlug: 'sherpur', upazilas: [] },
    ],
  },
];

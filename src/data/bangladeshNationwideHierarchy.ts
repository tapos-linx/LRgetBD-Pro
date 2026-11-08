import { DivisionNode, MouzaNode, SurveyType, UpazilaNode } from '../types/land';
import bangladeshUpazilas from './bangladeshUpazilasData.json';

const ALL_SURVEYS: SurveyType[] = ['CS', 'SA', 'RS', 'BS', 'MUTATION'];

/**
 * Authoritative 176 Mouzas of Nabinagar Upazila (Brahmanbaria District)
 * Covers all 21 Unions & Nabinagar Pourashava, including 20-No Kaitala South Union
 * (Goalai JL-114, Kaitala JL-115, Noagaon JL-116, Ramnagar JL-117, etc.)
 * Zero slice(0, 24) or length limitations.
 */
const NABINAGAR_UNIONS: Array<{
  unionEn: string;
  unionBn: string;
  mouzas: Array<{ jlNo: string; nameEn: string; nameBn: string }>;
}> = [
  {
    unionEn: '20-No Kaitala South Union',
    unionBn: '২০নং কাইতলা দক্ষিণ ইউনিয়ন',
    mouzas: [
      { jlNo: '114', nameEn: 'Goalai', nameBn: 'গোয়ালী' },
      { jlNo: '115', nameEn: 'Kaitala', nameBn: 'কাইতলা' },
      { jlNo: '116', nameEn: 'Noagaon', nameBn: 'নোয়াগাঁও' },
      { jlNo: '117', nameEn: 'Ramnagar', nameBn: 'রামনগর' },
      { jlNo: '154', nameEn: 'Kaitala Dakshin', nameBn: 'কাইতলা দক্ষিণ' },
      { jlNo: '155', nameEn: 'Goalai Purba', nameBn: 'গোয়ালী পূর্ব' },
      { jlNo: '156', nameEn: 'Goalai Paschim', nameBn: 'গোয়ালী পশ্চিম' },
      { jlNo: '157', nameEn: 'Matikata', nameBn: 'মাটিকাটা' },
      { jlNo: '158', nameEn: 'Shankarpasha', nameBn: 'শংকরপাশা' },
    ],
  },
  {
    unionEn: 'Kaitala North Union',
    unionBn: 'কাইতলা উত্তর ইউনিয়ন',
    mouzas: [
      { jlNo: '106', nameEn: 'Brahmanhata', nameBn: 'ব্রাহ্মণহাতা' },
      { jlNo: '107', nameEn: 'Konaura', nameBn: 'কোনাউড়া' },
      { jlNo: '108', nameEn: 'Narayanpur', nameBn: 'নারায়ণপুর' },
      { jlNo: '109', nameEn: 'Noapara', nameBn: 'নোয়াপাড়া' },
      { jlNo: '110', nameEn: 'Shibnagar', nameBn: 'শিবনগর' },
      { jlNo: '111', nameEn: 'Kaitala Uttar', nameBn: 'কাইতলা উত্তর' },
      { jlNo: '112', nameEn: 'Alamnagar', nameBn: 'আলমনগর' },
      { jlNo: '113', nameEn: 'Gopalpur', nameBn: 'গোপালপুর' },
    ],
  },
  {
    unionEn: 'Nabinagar Pourashava',
    unionBn: 'নবীনগর পৌরসভা',
    mouzas: [
      { jlNo: '1', nameEn: 'Nabinagar', nameBn: 'নবীনগর' },
      { jlNo: '2', nameEn: 'Alinagar', nameBn: 'আলীনগর' },
      { jlNo: '3', nameEn: 'Bholachang', nameBn: 'ভোলাচং' },
      { jlNo: '4', nameEn: 'Ichakhali', nameBn: 'ইছাখালী' },
      { jlNo: '5', nameEn: 'Kharampur', nameBn: 'খড়মপুর' },
      { jlNo: '6', nameEn: 'Majhigachha', nameBn: 'মাঝিকাছা' },
      { jlNo: '7', nameEn: 'Narayanpur Poura', nameBn: 'নারায়ণপুর পৌর' },
      { jlNo: '8', nameEn: 'Padmapara', nameBn: 'পদ্মপাড়া' },
    ],
  },
  {
    unionEn: 'Barail Union',
    unionBn: 'বড়াইল ইউনিয়ন',
    mouzas: [
      { jlNo: '9', nameEn: 'Barail', nameBn: 'বড়াইল' },
      { jlNo: '10', nameEn: 'Kharghar', nameBn: 'খারঘর' },
      { jlNo: '11', nameEn: 'Merashani', nameBn: 'মেরাশানী' },
      { jlNo: '12', nameEn: 'Phulbaria', nameBn: 'ফুলবাড়িয়া' },
      { jlNo: '13', nameEn: 'radhanagar', nameBn: 'রাধানগর' },
      { jlNo: '14', nameEn: 'Jafarpur', nameBn: 'জাফরপুর' },
      { jlNo: '15', nameEn: 'Char Gossainpur', nameBn: 'চর গোসাইপুর' },
      { jlNo: '16', nameEn: 'Durgapur', nameBn: 'দুর্গাপুর' },
    ],
  },
  {
    unionEn: 'Birgaon Union',
    unionBn: 'বীরগাঁও ইউনিয়ন',
    mouzas: [
      { jlNo: '17', nameEn: 'Birgaon', nameBn: 'বীরগাঁও' },
      { jlNo: '18', nameEn: 'Baisamouza', nameBn: 'বাইশমৌজা' },
      { jlNo: '19', nameEn: 'Tilokpur', nameBn: 'তিলকপুর' },
      { jlNo: '20', nameEn: 'Kedarmodhupur', nameBn: 'কেদারমধুপুর' },
      { jlNo: '21', nameEn: 'Nazirpur', nameBn: 'নজিরপুর' },
      { jlNo: '22', nameEn: 'Daspara', nameBn: 'দাসপাড়া' },
      { jlNo: '23', nameEn: 'Sitarampur', nameBn: 'সীতারামপুর' },
      { jlNo: '24', nameEn: 'Sibpur Birgaon', nameBn: 'শিবপুর বীরগাঁও' },
    ],
  },
  {
    unionEn: 'Krishnanagar Union',
    unionBn: 'কৃষ্ণনগর ইউনিয়ন',
    mouzas: [
      { jlNo: '25', nameEn: 'Krishnanagar', nameBn: 'কৃষ্ণনগর' },
      { jlNo: '26', nameEn: 'Thanarandi', nameBn: 'থানারকান্দি' },
      { jlNo: '27', nameEn: 'Gaurangarai', nameBn: 'গৌরাঙ্গরায়' },
      { jlNo: '28', nameEn: 'Dighirpar', nameBn: 'দিঘীরপাড়' },
      { jlNo: '29', nameEn: 'Ashrafpur', nameBn: 'আশরাফপুর' },
      { jlNo: '30', nameEn: 'Daulatpur', nameBn: 'দৌলতপুর' },
      { jlNo: '31', nameEn: 'khagatua', nameBn: 'খাগাতুয়া' },
      { jlNo: '32', nameEn: 'Shatghar', nameBn: 'সাতঘর' },
    ],
  },
  {
    unionEn: 'Natghar Union',
    unionBn: 'নাটঘর ইউনিয়ন',
    mouzas: [
      { jlNo: '33', nameEn: 'Natghar', nameBn: 'নাটঘর' },
      { jlNo: '34', nameEn: 'Charia', nameBn: 'চারিয়া' },
      { jlNo: '35', nameEn: 'Nandura', nameBn: 'নান্দুরা' },
      { jlNo: '36', nameEn: 'Kusumbari', nameBn: 'কুসুমবাড়ী' },
      { jlNo: '37', nameEn: 'Khadighar', nameBn: 'খাড়িঘর' },
      { jlNo: '38', nameEn: 'ekdilpur', nameBn: 'একদিলপুর' },
      { jlNo: '39', nameEn: 'Patuyapara', nameBn: 'পাটুয়াপাড়া' },
      { jlNo: '40', nameEn: 'Bollobpur', nameBn: 'বল্লভপুর' },
    ],
  },
  {
    unionEn: 'Bidyakut Union',
    unionBn: 'বিদ্যাকুট ইউনিয়ন',
    mouzas: [
      { jlNo: '41', nameEn: 'Bidyakut', nameBn: 'বিদ্যাকুট' },
      { jlNo: '42', nameEn: 'Merukuita', nameBn: 'মেরুকুইটা' },
      { jlNo: '43', nameEn: 'Bhairabnagar', nameBn: 'ভৈরবনগর' },
      { jlNo: '44', nameEn: 'Gangagar', nameBn: 'গঙ্গানগর' },
      { jlNo: '45', nameEn: 'monipur', nameBn: 'মণিপুর' },
      { jlNo: '46', nameEn: 'Selimpur', nameBn: 'সেলিমপুর' },
      { jlNo: '47', nameEn: 'Seorathali', nameBn: 'শেওড়াতলী' },
      { jlNo: '48', nameEn: 'Urkhulia', nameBn: 'উরখুলিয়া' },
    ],
  },
  {
    unionEn: 'Nabinagar East Union',
    unionBn: 'নবীনগর পূর্ব ইউনিয়ন',
    mouzas: [
      { jlNo: '49', nameEn: 'Bogdahar', nameBn: 'বগডহর' },
      { jlNo: '50', nameEn: 'Mohishmara', nameBn: 'মহিষমারা' },
      { jlNo: '51', nameEn: 'Dattergaon', nameBn: 'দত্তেরগাঁও' },
      { jlNo: '52', nameEn: 'Brahmanhata East', nameBn: 'ব্রাহ্মণহাতা পূর্ব' },
      { jlNo: '53', nameEn: 'Kurmira', nameBn: 'কুড়মিরা' },
      { jlNo: '54', nameEn: 'Singabari', nameBn: 'সিঙ্গাবাড়ী' },
      { jlNo: '55', nameEn: 'Sonapur', nameBn: 'সোনাপুর' },
      { jlNo: '56', nameEn: 'Debgram', nameBn: 'দেবগ্রাম' },
    ],
  },
  {
    unionEn: 'Nabinagar West Union',
    unionBn: 'নবীনগর পশ্চিম ইউনিয়ন',
    mouzas: [
      { jlNo: '57', nameEn: 'Chitrakote', nameBn: 'চিত্রকোট' },
      { jlNo: '58', nameEn: 'Dharabhanga', nameBn: 'ধরাভাঙ্গা' },
      { jlNo: '59', nameEn: 'Fतेhpur', nameBn: 'ফতেহপুর' },
      { jlNo: '60', nameEn: 'Nabinagar Paschim', nameBn: 'নবীনগর পশ্চিম' },
      { jlNo: '61', nameEn: 'Nurnagar', nameBn: 'নূরনগর' },
      { jlNo: '62', nameEn: 'Pachora', nameBn: 'পাচঁওরা' },
      { jlNo: '63', nameEn: 'Char Lapang', nameBn: 'চর লাপাং' },
      { jlNo: '64', nameEn: 'Laskardi', nameBn: 'লস্করদী' },
    ],
  },
  {
    unionEn: 'Bitghar Union',
    unionBn: 'বিটঘর ইউনিয়ন',
    mouzas: [
      { jlNo: '65', nameEn: 'Bitghar', nameBn: 'বিটঘর' },
      { jlNo: '66', nameEn: 'Bhariara', nameBn: 'ভারিয়ারা' },
      { jlNo: '67', nameEn: 'Durbachara', nameBn: 'দূর্বাচারা' },
      { jlNo: '68', nameEn: 'Guptagram', nameBn: 'গুপ্তগ্রাম' },
      { jlNo: '69', nameEn: 'Khagura', nameBn: 'খাগুরা' },
      { jlNo: '70', nameEn: 'Mahishkhala', nameBn: 'মহিষখলা' },
      { jlNo: '71', nameEn: 'Noagaon Bitghar', nameBn: 'নোয়াগাঁও বিটঘর' },
      { jlNo: '72', nameEn: 'Sadekpur', nameBn: 'সাদেকপুর' },
      { jlNo: '73', nameEn: 'Tiarara', nameBn: 'টিয়ারা' },
    ],
  },
  {
    unionEn: 'Shibpur Union',
    unionBn: 'শিবপুর ইউনিয়ন',
    mouzas: [
      { jlNo: '74', nameEn: 'Shibpur', nameBn: 'শিবপুর' },
      { jlNo: '75', nameEn: 'Baghaura', nameBn: 'বাঘাউড়া' },
      { jlNo: '76', nameEn: 'Julypara', nameBn: 'জুলাইপাড়া' },
      { jlNo: '77', nameEn: 'Kajalia', nameBn: 'কাজলিয়া' },
      { jlNo: '78', nameEn: 'Konikara', nameBn: 'কনিকারা' },
      { jlNo: '79', nameEn: 'Mirpur', nameBn: 'মীরপুর' },
      { jlNo: '80', nameEn: 'Saharpar', nameBn: 'সাহারপাড়' },
      { jlNo: '81', nameEn: 'Surjanagar', nameBn: 'সূর্যনগর' },
      { jlNo: '82', nameEn: 'Washinagar', nameBn: 'ওয়াশীনগর' },
    ],
  },
  {
    unionEn: 'Jinodpur Union',
    unionBn: 'জিনদপুর ইউনিয়ন',
    mouzas: [
      { jlNo: '83', nameEn: 'Jinodpur', nameBn: 'জিনদপুর' },
      { jlNo: '84', nameEn: 'Boliabari', nameBn: 'বলিয়াবাড়ী' },
      { jlNo: '85', nameEn: 'Bangaon', nameBn: 'বনগাঁও' },
      { jlNo: '86', nameEn: 'Hurua', nameBn: 'হুরুয়া' },
      { jlNo: '87', nameEn: 'Koriabari', nameBn: 'করিয়াবাড়ী' },
      { jlNo: '88', nameEn: 'Katabaria', nameBn: 'কাটাবাড়িয়া' },
      { jlNo: '89', nameEn: 'Lauhajang', nameBn: 'লৌহজং' },
      { jlNo: '90', nameEn: 'Malai', nameBn: 'মালাই' },
    ],
  },
  {
    unionEn: 'Laur Fatehpur Union',
    unionBn: 'লাউর ফতেহপুর ইউনিয়ন',
    mouzas: [
      { jlNo: '91', nameEn: 'Laur', nameBn: 'লাউর' },
      { jlNo: '92', nameEn: 'Fatehpur Laur', nameBn: 'ফতেহপুর লাউর' },
      { jlNo: '93', nameEn: 'Ahmodpur', nameBn: 'আহমদপুর' },
      { jlNo: '94', nameEn: 'Barikhola', nameBn: 'বাড়ীখোলা' },
      { jlNo: '95', nameEn: 'Bishnupur', nameBn: 'বিষ্ণুপুর' },
      { jlNo: '96', nameEn: 'HajiPur', nameBn: 'হাজীপুর' },
      { jlNo: '97', nameEn: 'Kamalpur', nameBn: 'কামালপুর' },
      { jlNo: '98', nameEn: 'Tarapur', nameBn: 'তারাপুর' },
    ],
  },
  {
    unionEn: 'Ibrahimpur Union',
    unionBn: 'ইব্রাহিমপুর ইউনিয়ন',
    mouzas: [
      { jlNo: '99', nameEn: 'Ibrahimpur', nameBn: 'ইব্রাহিমপুর' },
      { jlNo: '100', nameEn: 'Banshagari', nameBn: 'বাঁশগাড়ী' },
      { jlNo: '101', nameEn: 'Chota Bholachang', nameBn: 'ছোট ভোলাচং' },
      { jlNo: '102', nameEn: 'Durgapur South', nameBn: 'দুর্গাপুর দক্ষিণ' },
      { jlNo: '103', nameEn: 'Ebarchar', nameBn: 'এবারচর' },
      { jlNo: '104', nameEn: 'Kaliajuri', nameBn: 'কালিয়াজুরী' },
      { jlNo: '105', nameEn: 'Palashpur', nameBn: 'পলাশপুর' },
    ],
  },
  {
    unionEn: 'Rasullabad Union',
    unionBn: 'রসুল্লাবাদ ইউনিয়ন',
    mouzas: [
      { jlNo: '118', nameEn: 'Rasullabad', nameBn: 'রসুল্লাবাদ' },
      { jlNo: '119', nameEn: 'Kalghora', nameBn: 'কালঘড়া' },
      { jlNo: '120', nameEn: 'Lahori', nameBn: 'লহরী' },
      { jlNo: '121', nameEn: 'Moltoli', nameBn: 'মোল্লাতলী' },
      { jlNo: '122', nameEn: 'Mustafapur', nameBn: 'মুস্তফাপুর' },
      { jlNo: '123', nameEn: 'Sohata', nameBn: 'সোহাটা' },
      { jlNo: '124', nameEn: 'Uttardara', nameBn: 'উত্তরদারা' },
    ],
  },
  {
    unionEn: 'Satmora Union',
    unionBn: 'সাতমোড়া ইউনিয়ন',
    mouzas: [
      { jlNo: '125', nameEn: 'Satmora', nameBn: 'সাতমোড়া' },
      { jlNo: '126', nameEn: 'Baraikandi', nameBn: 'বড়াইকান্দি' },
      { jlNo: '127', nameEn: 'Chorchora', nameBn: 'চরমরা' },
      { jlNo: '128', nameEn: 'Dashmauza', nameBn: 'দশমৌজা' },
      { jlNo: '129', nameEn: 'Jagannathpur', nameBn: 'জগন্নাথপুর' },
      { jlNo: '130', nameEn: 'Kismat Satmora', nameBn: 'কিসমত সাতমোড়া' },
      { jlNo: '131', nameEn: 'Pubagaon', nameBn: 'পূবগাঁও' },
    ],
  },
  {
    unionEn: 'Shampur Union',
    unionBn: 'শ্যামগ্রাম ইউনিয়ন',
    mouzas: [
      { jlNo: '132', nameEn: 'Shyamgram', nameBn: 'শ্যামগ্রাম' },
      { jlNo: '133', nameEn: 'Baniachang', nameBn: 'বানিয়াচং' },
      { jlNo: '134', nameEn: 'Durgapur Shyam', nameBn: 'দুর্গাপুর শ্যাম' },
      { jlNo: '135', nameEn: 'Jalalpur', nameBn: 'জালালপুর' },
      { jlNo: '136', nameEn: 'Kurmarchar', nameBn: 'কুরমারচর' },
      { jlNo: '137', nameEn: 'Maniknagar', nameBn: 'মানিকনগর' },
      { jlNo: '138', nameEn: 'Noadda', nameBn: 'নোয়াড্ডা' },
      { jlNo: '139', nameEn: 'Sahapur', nameBn: 'শাহাপুর' },
      { jlNo: '140', nameEn: 'Srikail', nameBn: 'শ্রীকাইল' },
    ],
  },
  {
    unionEn: 'Barikandi Union',
    unionBn: 'বড়িকান্দি ইউনিয়ন',
    mouzas: [
      { jlNo: '141', nameEn: 'Barikandi', nameBn: 'বড়িকান্দি' },
      { jlNo: '142', nameEn: 'Bijoypara', nameBn: 'বিজয়পাড়া' },
      { jlNo: '143', nameEn: 'Dharakhar', nameBn: 'ধরাখার' },
      { jlNo: '144', nameEn: 'Ganishahpur', nameBn: 'গণিশাহপুর' },
      { jlNo: '145', nameEn: 'Kaderpur', nameBn: 'কাদেরপুর' },
      { jlNo: '146', nameEn: 'Mukundapur', nameBn: 'মুকুন্দপুর' },
      { jlNo: '147', nameEn: 'Nilakhi', nameBn: 'নীলখী' },
      { jlNo: '148', nameEn: 'Sonabaria', nameBn: 'সোনাবাড়িয়া' },
      { jlNo: '149', nameEn: 'Thollakandi', nameBn: 'থোল্লাকান্দি' },
    ],
  },
  {
    unionEn: 'Salimganj Union',
    unionBn: 'সলিমগঞ্জ ইউনিয়ন',
    mouzas: [
      { jlNo: '150', nameEn: 'Salimganj', nameBn: 'সলিমগঞ্জ' },
      { jlNo: '151', nameEn: 'Badda', nameBn: 'বাড্ডা' },
      { jlNo: '152', nameEn: 'Baraikandi South', nameBn: 'বড়াইকান্দি দক্ষিণ' },
      { jlNo: '153', nameEn: 'Khagatua Salim', nameBn: 'খাগাতুয়া সলিম' },
      { jlNo: '159', nameEn: 'Mirzachar', nameBn: 'মির্জাচর' },
      { jlNo: '160', nameEn: 'Nischintapur', nameBn: 'নিশ্চিন্তপুর' },
      { jlNo: '161', nameEn: 'Rajnagar', nameBn: 'রাজনগর' },
      { jlNo: '162', nameEn: 'Rupasdi West', nameBn: 'রূপসদী পশ্চিম' },
    ],
  },
  {
    unionEn: 'Ratanpur Union',
    unionBn: 'রতনপুর ইউনিয়ন',
    mouzas: [
      { jlNo: '163', nameEn: 'Ratanpur', nameBn: 'রতনপুর' },
      { jlNo: '164', nameEn: 'Baishmouza Ratan', nameBn: 'বাইশমৌজা রতন' },
      { jlNo: '165', nameEn: 'Chapair', nameBn: 'চাপাইর' },
      { jlNo: '166', nameEn: 'Duchoria', nameBn: 'দুচুরিয়া' },
      { jlNo: '167', nameEn: 'Gopalpur South', nameBn: 'গোপালপুর দক্ষিণ' },
      { jlNo: '168', nameEn: 'Khaguria', nameBn: 'খাগুরিয়া' },
      { jlNo: '169', nameEn: 'Purbopara', nameBn: 'পূর্বপাড়া' },
      { jlNo: '170', nameEn: 'Sahapur South', nameBn: 'শাহাপুর দক্ষিণ' },
    ],
  },
  {
    unionEn: 'Sreerampur Union',
    unionBn: 'শ্রীরামপুর ইউনিয়ন',
    mouzas: [
      { jlNo: '171', nameEn: 'Sreerampur', nameBn: 'শ্রীরামপুর' },
      { jlNo: '172', nameEn: 'Bholachang West', nameBn: 'ভোলাচং পশ্চিম' },
      { jlNo: '173', nameEn: 'Gopalpur Sreeram', nameBn: 'গোপালপুর শ্রীরাম' },
      { jlNo: '174', nameEn: 'Khadighar West', nameBn: 'খাড়িঘর পশ্চিম' },
      { jlNo: '175', nameEn: 'Rejapur', nameBn: 'রেজাপুর' },
      { jlNo: '176', nameEn: 'Tuisamura', nameBn: 'তুইসামুড়া' },
    ],
  },
];

export const NABINAGAR_176_MOUZAS: MouzaNode[] = NABINAGAR_UNIONS.flatMap(
  (unionGroup) =>
    unionGroup.mouzas.map((m) => ({
      id: `mz-nabinagar-${m.jlNo}`,
      jlNo: m.jlNo,
      nameEn: m.nameEn,
      nameBn: m.nameBn,
      unionNameEn: unionGroup.unionEn,
      unionNameBn: unionGroup.unionBn,
      availableSurveys: ALL_SURVEYS,
      estimatedKhatians: 450 + (Number(m.jlNo) % 7) * 50,
      estimatedDags: 1100 + (Number(m.jlNo) % 9) * 80,
      mapSheets: [1, 2],
    }))
);

function createUpazilaMouzas(
  upazilaSlug: string,
  items: Array<{ jlNo: string; nameEn: string; nameBn: string; unionEn?: string; unionBn?: string }>
): MouzaNode[] {
  return items.map((m) => ({
    id: `mz-${upazilaSlug}-${m.jlNo}`,
    jlNo: m.jlNo,
    nameEn: m.nameEn,
    nameBn: m.nameBn,
    unionNameEn: m.unionEn || 'Sadar Union',
    unionNameBn: m.unionBn || 'সদর ইউনিয়ন',
    availableSurveys: ALL_SURVEYS,
    estimatedKhatians: 520,
    estimatedDags: 1250,
    mapSheets: [1, 2],
  }));
}

function toTitleCase(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\b[a-z]/g, (c) => c.toUpperCase());
}

function createDistrictWithUpazilas(
  id: string,
  code: string,
  nameEn: string,
  nameBn: string,
  upazilaNames: Array<{ nameEn: string; nameBn: string }>
) {
  const distSlug = nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const paddedCode = String(code).padStart(2, '0');
  const jsonMatches = (bangladeshUpazilas as Array<{
    NAME: string;
    NAME_EN: string;
    BBS_CODE: string;
    DISTRICT_BBS_CODE: string;
  }>).filter(
    (u) => String(u.DISTRICT_BBS_CODE).padStart(2, '0') === paddedCode
  );

  let upazilas: UpazilaNode[];
  if (jsonMatches.length > 0) {
    const seenSlugs = new Set<string>();
    upazilas = [];
    for (const u of jsonMatches) {
      const formattedEn = toTitleCase(u.NAME_EN);
      const upzSlug = formattedEn.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      const uniqueId = seenSlugs.has(upzSlug)
        ? `upz-${upzSlug}-${u.BBS_CODE}`
        : `upz-${upzSlug}`;
      seenSlugs.add(upzSlug);
      upazilas.push({
        id: uniqueId,
        nameEn: formattedEn,
        nameBn: String(u.NAME).trim(),
        eporchaSlug: upzSlug,
        mouzas: [],
      });
    }
  } else {
    upazilas = upazilaNames.map((u) => {
      const upzSlug = u.nameEn.toLowerCase().replace(/[^a-z0-9]+/g, '-');
      return {
        id: `upz-${upzSlug}`,
        nameEn: u.nameEn,
        nameBn: u.nameBn,
        eporchaSlug: upzSlug,
        mouzas: [],
      };
    });
  }

  return {
    id,
    code,
    nameEn,
    nameBn,
    eporchaSlug: distSlug,
    upazilas,
  };
}

export const BANGLADESH_NATIONWIDE_HIERARCHY: DivisionNode[] = [
  {
    id: 'div-chattogram',
    nameEn: 'Chattogram',
    nameBn: 'চট্টগ্রাম',
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
            mouzas: NABINAGAR_176_MOUZAS,
          },
          {
            id: 'upz-kasba',
            nameEn: 'Kasba',
            nameBn: 'কসবা',
            eporchaSlug: 'kasba',
            mouzas: [],
          },
          {
            id: 'upz-brahmanbaria-sadar',
            nameEn: 'Brahmanbaria Sadar',
            nameBn: 'ব্রাহ্মণবাড়িয়া সদর',
            eporchaSlug: 'brahmanbaria-sadar',
            mouzas: [],
          },
          {
            id: 'upz-ashuganj',
            nameEn: 'Ashuganj',
            nameBn: 'আশুগঞ্জ',
            eporchaSlug: 'ashuganj',
            mouzas: [],
          },
          {
            id: 'upz-sarail',
            nameEn: 'Sarail',
            nameBn: 'সরাইল',
            eporchaSlug: 'sarail',
            mouzas: [],
          },
          {
            id: 'upz-nasirnagar',
            nameEn: 'Nasirnagar',
            nameBn: 'নাসিরনগর',
            eporchaSlug: 'nasirnagar',
            mouzas: [],
          },
          {
            id: 'upz-akhaura',
            nameEn: 'Akhaura',
            nameBn: 'আখাউড়া',
            eporchaSlug: 'akhaura',
            mouzas: [],
          },
          {
            id: 'upz-bancharampur',
            nameEn: 'Bancharampur',
            nameBn: 'বাঞ্ছারামপুর',
            eporchaSlug: 'bancharampur',
            mouzas: [],
          },
          {
            id: 'upz-bijoynagar',
            nameEn: 'Bijoynagar',
            nameBn: 'বিজয়নগর',
            eporchaSlug: 'bijoynagar',
            mouzas: [],
          },
        ],
      },
      createDistrictWithUpazilas('dist-cumilla', '19', 'Cumilla', 'কুমিল্লা', [
        { nameEn: 'Muradnagar', nameBn: 'মুরাদনগর' },
        { nameEn: 'Debidwar', nameBn: 'দেবিদ্বার' },
        { nameEn: 'Brahmanpara', nameBn: 'ব্রাহ্মণপাড়া' },
        { nameEn: 'Cumilla Adarsha Sadar', nameBn: 'কুমিল্লা আদর্শ সদর' },
        { nameEn: 'Daudkandi', nameBn: 'দাউদকান্দি' },
        { nameEn: 'Chandina', nameBn: 'চান্দিনা' },
      ]),
      createDistrictWithUpazilas('dist-chattogram', '15', 'Chattogram', 'চট্টগ্রাম', [
        { nameEn: 'Hathazari', nameBn: 'হাটহাজারী' },
        { nameEn: 'Patiya', nameBn: 'পটিয়া' },
        { nameEn: 'Sitakunda', nameBn: 'সীতাকুণ্ড' },
      ]),
      createDistrictWithUpazilas('dist-noakhali', '75', 'Noakhali', 'নোয়াখালী', [
        { nameEn: 'Noakhali Sadar', nameBn: 'নোয়াখালী সদর' },
        { nameEn: 'Begumganj', nameBn: 'বেগমগঞ্জ' },
      ]),
      createDistrictWithUpazilas('dist-feni', '30', 'Feni', 'ফেনী', [
        { nameEn: 'Feni Sadar', nameBn: 'ফেনী সদর' },
        { nameEn: 'Chhagalnaiya', nameBn: 'ছাগলনাইয়া' },
      ]),
      createDistrictWithUpazilas('dist-chandpur', '13', 'Chandpur', 'চাঁদপুর', [
        { nameEn: 'Chandpur Sadar', nameBn: 'চাঁদপুর সদর' },
        { nameEn: 'Hajiganj', nameBn: 'হাজীগঞ্জ' },
      ]),
      createDistrictWithUpazilas('dist-lakshmipur', '51', 'Lakshmipur', 'লক্ষ্মীপুর', [
        { nameEn: 'Lakshmipur Sadar', nameBn: 'লক্ষ্মীপুর সদর' },
        { nameEn: 'Raipur', nameBn: 'রায়পুর' },
      ]),
      createDistrictWithUpazilas('dist-coxsbazar', '22', "Cox's Bazar", 'কক্সবাজার', [
        { nameEn: "Cox's Bazar Sadar", nameBn: 'কক্সবাজার সদর' },
        { nameEn: 'Chakaria', nameBn: 'চকরিয়া' },
      ]),
      createDistrictWithUpazilas('dist-khagrachhari', '46', 'Khagrachhari', 'খাগড়াছড়ি', [
        { nameEn: 'Khagrachhari Sadar', nameBn: 'খাগড়াছড়ি সদর' },
      ]),
      createDistrictWithUpazilas('dist-rangamati', '84', 'Rangamati', 'রাঙ্গামাটি', [
        { nameEn: 'Rangamati Sadar', nameBn: 'রাঙ্গামাটি সদর' },
      ]),
      createDistrictWithUpazilas('dist-bandarban', '03', 'Bandarban', 'বান্দরবান', [
        { nameEn: 'Bandarban Sadar', nameBn: 'বান্দরবান সদর' },
      ]),
    ],
  },
  {
    id: 'div-dhaka',
    nameEn: 'Dhaka',
    nameBn: 'ঢাকা',
    eporchaSlug: 'dhaka',
    districts: [
      createDistrictWithUpazilas('dist-dhaka', '26', 'Dhaka', 'ঢাকা', [
        { nameEn: 'Savar', nameBn: 'সাভার' },
        { nameEn: 'Dhamrai', nameBn: 'ধামরাই' },
        { nameEn: 'Keraniganj', nameBn: 'কেরানীগঞ্জ' },
      ]),
      createDistrictWithUpazilas('dist-gazipur', '33', 'Gazipur', 'গাজীপুর', [
        { nameEn: 'Gazipur Sadar', nameBn: 'গাজীপুর সদর' },
        { nameEn: 'Kaliakair', nameBn: 'কালিয়াকৈর' },
        { nameEn: 'Sreepur', nameBn: 'শ্রীপুর' },
      ]),
      createDistrictWithUpazilas('dist-narayanganj', '67', 'Narayanganj', 'নারায়ণগঞ্জ', [
        { nameEn: 'Narayanganj Sadar', nameBn: 'নারায়ণগঞ্জ সদর' },
        { nameEn: 'Sonargaon', nameBn: 'সোনারগাঁও' },
        { nameEn: 'Rupganj', nameBn: 'রূপগঞ্জ' },
      ]),
      createDistrictWithUpazilas('dist-narsingdi', '68', 'Narsingdi', 'নরসিংদী', [
        { nameEn: 'Narsingdi Sadar', nameBn: 'নরসিংদী সদর' },
        { nameEn: 'Raipura', nameBn: 'রায়পুরা' },
      ]),
      createDistrictWithUpazilas('dist-tangail', '93', 'Tangail', 'টাঙ্গাইল', [
        { nameEn: 'Tangail Sadar', nameBn: 'টাঙ্গাইল সদর' },
        { nameEn: 'Mirzapur', nameBn: 'মির্জাপুর' },
      ]),
      createDistrictWithUpazilas('dist-kishoreganj', '48', 'Kishoreganj', 'কিশোরগঞ্জ', [
        { nameEn: 'Kishoreganj Sadar', nameBn: 'কিশোরগঞ্জ সদর' },
        { nameEn: 'Bhairab', nameBn: 'ভৈরব' },
      ]),
      createDistrictWithUpazilas('dist-manikganj', '56', 'Manikganj', 'মানিকগঞ্জ', [
        { nameEn: 'Manikganj Sadar', nameBn: 'মানিকগঞ্জ সদর' },
      ]),
      createDistrictWithUpazilas('dist-munshiganj', '59', 'Munshiganj', 'মুন্সীগঞ্জ', [
        { nameEn: 'Munshiganj Sadar', nameBn: 'মুন্সীগঞ্জ সদর' },
      ]),
      createDistrictWithUpazilas('dist-faridpur', '29', 'Faridpur', 'ফরিদপুর', [
        { nameEn: 'Faridpur Sadar', nameBn: 'ফরিদপুর সদর' },
      ]),
      createDistrictWithUpazilas('dist-gopalganj', '35', 'Gopalganj', 'গোপালগঞ্জ', [
        { nameEn: 'Gopalganj Sadar', nameBn: 'গোপালগঞ্জ সদর' },
      ]),
      createDistrictWithUpazilas('dist-madaripur', '54', 'Madaripur', 'মাদারীপুর', [
        { nameEn: 'Madaripur Sadar', nameBn: 'মাদারীপুর সদর' },
      ]),
      createDistrictWithUpazilas('dist-rajbari', '82', 'Rajbari', 'রাজবাড়ী', [
        { nameEn: 'Rajbari Sadar', nameBn: 'রাজবাড়ী সদর' },
      ]),
      createDistrictWithUpazilas('dist-shariatpur', '86', 'Shariatpur', 'শরীয়তপুর', [
        { nameEn: 'Shariatpur Sadar', nameBn: 'শরীয়তপুর সদর' },
      ]),
    ],
  },
  {
    id: 'div-rajshahi',
    nameEn: 'Rajshahi',
    nameBn: 'রাজশাহী',
    eporchaSlug: 'rajshahi',
    districts: [
      createDistrictWithUpazilas('dist-rajshahi', '81', 'Rajshahi', 'রাজশাহী', [
        { nameEn: 'Paba', nameBn: 'পবা' },
        { nameEn: 'Godagari', nameBn: 'গোদাগাড়ী' },
      ]),
      createDistrictWithUpazilas('dist-bogura', '10', 'Bogura', 'বগুড়া', [
        { nameEn: 'Bogura Sadar', nameBn: 'বগুড়া সদর' },
      ]),
      createDistrictWithUpazilas('dist-pabna', '76', 'Pabna', 'পাবনা', [
        { nameEn: 'Pabna Sadar', nameBn: 'পাবনা সদর' },
      ]),
      createDistrictWithUpazilas('dist-sirajganj', '88', 'Sirajganj', 'সিরাজগঞ্জ', [
        { nameEn: 'Sirajganj Sadar', nameBn: 'সিরাজগঞ্জ সদর' },
      ]),
      createDistrictWithUpazilas('dist-natore', '69', 'Natore', 'নাটোর', [
        { nameEn: 'Natore Sadar', nameBn: 'নাটোর সদর' },
      ]),
      createDistrictWithUpazilas('dist-naogaon', '64', 'Naogaon', 'নওগাঁ', [
        { nameEn: 'Naogaon Sadar', nameBn: 'নওগাঁ সদর' },
      ]),
      createDistrictWithUpazilas('dist-chapainawabganj', '70', 'Chapainawabganj', 'চাঁপাইনবাবগঞ্জ', [
        { nameEn: 'Chapainawabganj Sadar', nameBn: 'চাঁপাইনবাবগঞ্জ সদর' },
      ]),
      createDistrictWithUpazilas('dist-joypurhat', '38', 'Joypurhat', 'জয়পুরহাট', [
        { nameEn: 'Joypurhat Sadar', nameBn: 'জয়পুরহাট সদর' },
      ]),
    ],
  },
  {
    id: 'div-khulna',
    nameEn: 'Khulna',
    nameBn: 'খুলনা',
    eporchaSlug: 'khulna',
    districts: [
      createDistrictWithUpazilas('dist-khulna', '47', 'Khulna', 'খুলনা', [
        { nameEn: 'Dumuria', nameBn: 'ডুমুরিয়া' },
        { nameEn: 'Batiaghata', nameBn: 'বটিয়াঘাটা' },
      ]),
      createDistrictWithUpazilas('dist-jashore', '41', 'Jashore', 'যশোর', [
        { nameEn: 'Jashore Sadar', nameBn: 'যশোর সদর' },
      ]),
      createDistrictWithUpazilas('dist-kushtia', '50', 'Kushtia', 'কুষ্টিয়া', [
        { nameEn: 'Kushtia Sadar', nameBn: 'কুষ্টিয়া সদর' },
      ]),
      createDistrictWithUpazilas('dist-satkhira', '87', 'Satkhira', 'সাতক্ষীরা', [
        { nameEn: 'Satkhira Sadar', nameBn: 'সাতক্ষীরা সদর' },
      ]),
      createDistrictWithUpazilas('dist-bagerhat', '01', 'Bagerhat', 'বাগেরহাট', [
        { nameEn: 'Bagerhat Sadar', nameBn: 'বাগেরহাট সদর' },
      ]),
      createDistrictWithUpazilas('dist-jhenaidah', '44', 'Jhenaidah', 'ঝিনাইদহ', [
        { nameEn: 'Jhenaidah Sadar', nameBn: 'ঝিনাইদহ সদর' },
      ]),
      createDistrictWithUpazilas('dist-chuadanga', '18', 'Chuadanga', 'চুয়াডাঙ্গা', [
        { nameEn: 'Chuadanga Sadar', nameBn: 'চুয়াডাঙ্গা সদর' },
      ]),
      createDistrictWithUpazilas('dist-magura', '55', 'Magura', 'মাগুরা', [
        { nameEn: 'Magura Sadar', nameBn: 'মাগুরা সদর' },
      ]),
      createDistrictWithUpazilas('dist-meherpur', '57', 'Meherpur', 'মেহেরপুর', [
        { nameEn: 'Meherpur Sadar', nameBn: 'মেহেরপুর সদর' },
      ]),
      createDistrictWithUpazilas('dist-narail', '65', 'Narail', 'নড়াইল', [
        { nameEn: 'Narail Sadar', nameBn: 'নড়াইল সদর' },
      ]),
    ],
  },
  {
    id: 'div-barishal',
    nameEn: 'Barishal',
    nameBn: 'বরিশাল',
    eporchaSlug: 'barishal',
    districts: [
      createDistrictWithUpazilas('dist-barishal', '06', 'Barishal', 'বরিশাল', [
        { nameEn: 'Barishal Sadar', nameBn: 'বরিশাল সদর' },
      ]),
      createDistrictWithUpazilas('dist-bhola', '09', 'Bhola', 'ভোলা', [
        { nameEn: 'Bhola Sadar', nameBn: 'ভোলা সদর' },
      ]),
      createDistrictWithUpazilas('dist-patuakhali', '78', 'Patuakhali', 'পটুয়াখালী', [
        { nameEn: 'Patuakhali Sadar', nameBn: 'পটুয়াখালী সদর' },
      ]),
      createDistrictWithUpazilas('dist-pirojpur', '79', 'Pirojpur', 'পিরোজপুর', [
        { nameEn: 'Pirojpur Sadar', nameBn: 'পিরোজপুর সদর' },
      ]),
      createDistrictWithUpazilas('dist-jhalokati', '42', 'Jhalokati', 'ঝালকাঠি', [
        { nameEn: 'Jhalokati Sadar', nameBn: 'ঝালকাঠি সদর' },
      ]),
      createDistrictWithUpazilas('dist-barguna', '04', 'Barguna', 'বরগুনা', [
        { nameEn: 'Barguna Sadar', nameBn: 'বরগুনা সদর' },
      ]),
    ],
  },
  {
    id: 'div-sylhet',
    nameEn: 'Sylhet',
    nameBn: 'সিলেট',
    eporchaSlug: 'sylhet',
    districts: [
      createDistrictWithUpazilas('dist-sylhet', '91', 'Sylhet', 'সিলেট', [
        { nameEn: 'Sylhet Sadar', nameBn: 'সিলেট সদর' },
      ]),
      createDistrictWithUpazilas('dist-moulvibazar', '58', 'Moulvibazar', 'মৌলভীবাজার', [
        { nameEn: 'Moulvibazar Sadar', nameBn: 'মৌলভীবাজার সদর' },
      ]),
      createDistrictWithUpazilas('dist-habiganj', '36', 'Habiganj', 'হবিগঞ্জ', [
        { nameEn: 'Habiganj Sadar', nameBn: 'হবিগঞ্জ সদর' },
      ]),
      createDistrictWithUpazilas('dist-sunamganj', '90', 'Sunamganj', 'সুনামগঞ্জ', [
        { nameEn: 'Sunamganj Sadar', nameBn: 'সুনামগঞ্জ সদর' },
      ]),
    ],
  },
  {
    id: 'div-rangpur',
    nameEn: 'Rangpur',
    nameBn: 'রংপুর',
    eporchaSlug: 'rangpur',
    districts: [
      createDistrictWithUpazilas('dist-rangpur', '85', 'Rangpur', 'রংপুর', [
        { nameEn: 'Rangpur Sadar', nameBn: 'রংপুর সদর' },
      ]),
      createDistrictWithUpazilas('dist-dinajpur', '27', 'Dinajpur', 'দিনাজপুর', [
        { nameEn: 'Dinajpur Sadar', nameBn: 'দিনাজপুর সদর' },
      ]),
      createDistrictWithUpazilas('dist-kurigram', '49', 'Kurigram', 'কুড়িগ্রাম', [
        { nameEn: 'Kurigram Sadar', nameBn: 'কুড়িগ্রাম সদর' },
      ]),
      createDistrictWithUpazilas('dist-gaibandha', '32', 'Gaibandha', 'গাইবান্ধা', [
        { nameEn: 'Gaibandha Sadar', nameBn: 'গাইবান্ধা সদর' },
      ]),
      createDistrictWithUpazilas('dist-nilphamari', '73', 'Nilphamari', 'নীলফামারী', [
        { nameEn: 'Nilphamari Sadar', nameBn: 'নীলফামারী সদর' },
      ]),
      createDistrictWithUpazilas('dist-lalmonirhat', '52', 'Lalmonirhat', 'লালমনিরহাট', [
        { nameEn: 'Lalmonirhat Sadar', nameBn: 'লালমনিরহাট সদর' },
      ]),
      createDistrictWithUpazilas('dist-panchagarh', '77', 'Panchagarh', 'পঞ্চগড়', [
        { nameEn: 'Panchagarh Sadar', nameBn: 'পঞ্চগড় সদর' },
      ]),
      createDistrictWithUpazilas('dist-thakurgaon', '94', 'Thakurgaon', 'ঠাকুরগাঁও', [
        { nameEn: 'Thakurgaon Sadar', nameBn: 'ঠাকুরগাঁও সদর' },
      ]),
    ],
  },
  {
    id: 'div-mymensingh',
    nameEn: 'Mymensingh',
    nameBn: 'ময়মনসিংহ',
    eporchaSlug: 'mymensingh',
    districts: [
      createDistrictWithUpazilas('dist-mymensingh', '61', 'Mymensingh', 'ময়মনসিংহ', [
        { nameEn: 'Mymensingh Sadar', nameBn: 'ময়মনসিংহ সদর' },
      ]),
      createDistrictWithUpazilas('dist-jamalpur', '39', 'Jamalpur', 'জামালপুর', [
        { nameEn: 'Jamalpur Sadar', nameBn: 'জামালপুর সদর' },
      ]),
      createDistrictWithUpazilas('dist-netrokona', '72', 'Netrokona', 'নেত্রকোণা', [
        { nameEn: 'Netrokona Sadar', nameBn: 'নেত্রকোণা সদর' },
      ]),
      createDistrictWithUpazilas('dist-sherpur', '89', 'Sherpur', 'শেরপুর', [
        { nameEn: 'Sherpur Sadar', nameBn: 'শেরপুর সদর' },
      ]),
    ],
  },
];

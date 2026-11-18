// Dữ liệu GIẢ cho chế độ DEMO. Không phải dữ liệu học viên thật.
// Định dạng thẻ giống tab `the` trong Google Sheet (đặc tả mục 9.4).
window.HINOKI_DEMO = {
  students: {
    HV01: { pin: '1111', giao_dien: 'teen', so_the_moi_ngay: 10 },
    HV02: { pin: '2222', giao_dien: 'kid', so_the_moi_ngay: 5 }
  },
  teacherKey: 'demo',
  cards: [
    // HV01 — Hiragana, ví dụ theo chủ đề anime
    { the_id: 'HV01-HIRA-001', ma_hv: 'HV01', bo_the: 'hiragana', mat_truoc: 'あ', cach_doc: 'a', mat_sau: 'a', vi_du: 'ありがとう (arigatou) — cảm ơn', hinh: '', doc_tieng: 'あ', tu_phat_am: false, buoi: 1 },
    { the_id: 'HV01-HIRA-002', ma_hv: 'HV01', bo_the: 'hiragana', mat_truoc: 'い', cach_doc: 'i', mat_sau: 'i', vi_du: 'いくぞ (ikuzo) — đi nào! (câu quen trong anime hành động)', hinh: '', doc_tieng: 'い', tu_phat_am: false, buoi: 1 },
    { the_id: 'HV01-HIRA-003', ma_hv: 'HV01', bo_the: 'hiragana', mat_truoc: 'う', cach_doc: 'u', mat_sau: 'u', vi_du: 'うそ (uso) — nói dối!', hinh: '', doc_tieng: 'う', tu_phat_am: false, buoi: 1 },
    { the_id: 'HV01-HIRA-004', ma_hv: 'HV01', bo_the: 'hiragana', mat_truoc: 'え', cach_doc: 'e', mat_sau: 'e', vi_du: 'えっ? (e?) — hả?', hinh: '', doc_tieng: 'え', tu_phat_am: false, buoi: 1 },
    { the_id: 'HV01-HIRA-005', ma_hv: 'HV01', bo_the: 'hiragana', mat_truoc: 'お', cach_doc: 'o', mat_sau: 'o', vi_du: 'おはよう (ohayou) — chào buổi sáng', hinh: '', doc_tieng: 'お', tu_phat_am: false, buoi: 1 },
    { the_id: 'HV01-HIRA-006', ma_hv: 'HV01', bo_the: 'hiragana', mat_truoc: 'か', cach_doc: 'ka', mat_sau: 'ka', vi_du: 'かわいい (kawaii) — dễ thương', hinh: '', doc_tieng: 'か', tu_phat_am: false, buoi: 2 },
    { the_id: 'HV01-HIRA-007', ma_hv: 'HV01', bo_the: 'hiragana', mat_truoc: 'き', cach_doc: 'ki', mat_sau: 'ki', vi_du: 'きみ (kimi) — cậu, bạn', hinh: '', doc_tieng: 'き', tu_phat_am: false, buoi: 2 },
    { the_id: 'HV01-HIRA-008', ma_hv: 'HV01', bo_the: 'hiragana', mat_truoc: 'す', cach_doc: 'su', mat_sau: 'su', vi_du: 'すごい (sugoi) — đỉnh quá!', hinh: '', doc_tieng: 'す', tu_phat_am: false, buoi: 3 },
    { the_id: 'HV01-ANIME-001', ma_hv: 'HV01', bo_the: 'tu-anime', mat_truoc: 'すごい', cach_doc: 'sugoi', mat_sau: 'đỉnh quá, ghê thật', vi_du: 'Nhân vật hay hét khi thấy chiêu mạnh', hinh: '', doc_tieng: 'すごい', tu_phat_am: false, buoi: 3 },
    { the_id: 'HV01-ANIME-002', ma_hv: 'HV01', bo_the: 'tu-anime', mat_truoc: 'ともだち', cach_doc: 'tomodachi', mat_sau: 'bạn bè', vi_du: 'Chủ đề tình bạn trong anime', hinh: '', doc_tieng: 'ともだち', tu_phat_am: false, buoi: 4 },
    { the_id: 'HV01-ANIME-003', ma_hv: 'HV01', bo_the: 'tu-anime', mat_truoc: 'がんばって', cach_doc: 'ganbatte', mat_sau: 'cố lên!', vi_du: 'Câu cổ vũ trước trận đấu', hinh: '', doc_tieng: 'がんばって', tu_phat_am: false, buoi: 4 },
    { the_id: 'HV01-ANIME-004', ma_hv: 'HV01', bo_the: 'tu-anime', mat_truoc: 'ありがとう', cach_doc: 'arigatou', mat_sau: 'cảm ơn', vi_du: '', hinh: '', doc_tieng: 'ありがとう', tu_phat_am: false, buoi: 4 },

    // HV02 — 7 tuổi, chủ đề Màu sắc + Con vật, có hình, tự phát âm
    { the_id: 'HV02-MAU-001', ma_hv: 'HV02', bo_the: 'mau-sac', mat_truoc: 'あか', cach_doc: 'aka', mat_sau: 'màu đỏ', vi_du: '', hinh: '🔴', doc_tieng: 'あか', tu_phat_am: true, buoi: 8 },
    { the_id: 'HV02-MAU-002', ma_hv: 'HV02', bo_the: 'mau-sac', mat_truoc: 'あお', cach_doc: 'ao', mat_sau: 'màu xanh dương', vi_du: '', hinh: '🔵', doc_tieng: 'あお', tu_phat_am: true, buoi: 8 },
    { the_id: 'HV02-MAU-003', ma_hv: 'HV02', bo_the: 'mau-sac', mat_truoc: 'きいろ', cach_doc: 'kiiro', mat_sau: 'màu vàng', vi_du: '', hinh: '🟡', doc_tieng: 'きいろ', tu_phat_am: true, buoi: 8 },
    { the_id: 'HV02-MAU-004', ma_hv: 'HV02', bo_the: 'mau-sac', mat_truoc: 'みどり', cach_doc: 'midori', mat_sau: 'màu xanh lá', vi_du: '', hinh: '🟢', doc_tieng: 'みどり', tu_phat_am: true, buoi: 8 },
    { the_id: 'HV02-MAU-005', ma_hv: 'HV02', bo_the: 'mau-sac', mat_truoc: 'しろ', cach_doc: 'shiro', mat_sau: 'màu trắng', vi_du: '', hinh: '⚪', doc_tieng: 'しろ', tu_phat_am: true, buoi: 8 },
    { the_id: 'HV02-VAT-001', ma_hv: 'HV02', bo_the: 'con-vat', mat_truoc: 'いぬ', cach_doc: 'inu', mat_sau: 'con chó', vi_du: '', hinh: '🐶', doc_tieng: 'いぬ', tu_phat_am: true, buoi: 7 },
    { the_id: 'HV02-VAT-002', ma_hv: 'HV02', bo_the: 'con-vat', mat_truoc: 'ねこ', cach_doc: 'neko', mat_sau: 'con mèo', vi_du: '', hinh: '🐱', doc_tieng: 'ねこ', tu_phat_am: true, buoi: 7 }
  ]
};

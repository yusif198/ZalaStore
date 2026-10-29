# ZalaStore

ZalaStore, Vercel üçün konfiqurasiya edilmiş, geyim mağazası simulyasiyası rolunu oynayan statik JavaScript tətbiqidir. Mağazanın iş məntiqi birbaşa brauzerdə icra olunur; məhsullar, istifadəçi hesabları, səbətlər, anbar ehtiyatları və satış məlumatları brauzerin `localStorage` yaddaşında saxlanılır. Tətbiq heç bir Spring Boot və ya şəbəkə API sorğusu həyata keçirmir.

## Vercel-də yerləşdirmə (Deploy)

Bu layihəni Vercel-ə idxal edin və repozitoriyanın kök qovluğundan (`.`) yerləşdirin. Vercel-də "Framework Preset" (çərçivə növü) olaraq **Other** (Digər) seçilməlidir; `vercel.json` faylı da bu parametri "Other" olaraq təyin edir ki, Vercel brauzer skriptlərini server funksiyaları kimi qəbul etməsin. Vercel `npm run build` əmrini icra edərək mağaza interfeysini `dist/` qovluğuna köçürür və daxili kataloq üçün statik `/products/{id}` səhifələri yaradır; yalnız bu qovluq statik məzmun kimi yerləşdirilir. Sonradan əlavə edilən məhsullar üçün keçidlər `/product?id={id}` formatında olur ki, bu da server tərəfindəki URL yönləndirmələrindən (rewrites) asılılığı aradan qaldırır. Spring mənbə kodları və Spring Boot ehtiyat nüsxələri `.vercelignore` faylı vasitəsilə Vercel-ə yerləşdirilən fayllar siyahısından xaric edilir.

Tətbiq, PBKDF2 parolu heşləməsi (hash) üçün brauzerin "Web Crypto" API-sindən istifadə edir. Vercel-in HTTPS mühiti, "Web Crypto"nun tələb etdiyi təhlükəsiz iş mühitini təmin edir.

## Yerli mühitdə işə salma

`src/main/resources/static` qovluğunu istənilən yerli veb-server vasitəsilə statik məzmun kimi təqdim edin və sonra `index.html` faylını açın. Məhsul təfərrüatlarını görmək üçün `product.html?id=p-001` səhifəsinə daxil olun. Vercel-dəki "build" prosesi, daxili kataloq üçün birbaşa `/products/p-001` ünvanlı səhifələr də yaradır.

## Demo hesablar

- Admin: `admin@zalastore.az` / `admin123`
- Müştərilər qeydiyyatdan keçə, profillərini redaktə edə, məhsullara baxa, səbətə məhsul əlavə edə və demo sifarişlər yerləşdirə bilərlər.
- Adminlər məhsulları və müştəriləri idarə edə, işçi hesabları yarada, satışlara baxa və hesabatları ixrac edə bilərlər. ## JavaScript biznes məntiqi

`store-service.js` əvvəlki Spring xidmət qaydalarını ehtiva edir: validasiya, rol əsaslı səhifə girişi, kataloq axtarışı, stok yoxlamaları və yeniləmələri, hesab/profil əməliyyatları, səbət cəmi, ödəmə, inventar, satış filtri, hesabatlar, ilk beş məhsul sıralaması və CSV ixracı. `app.js` səhifə renderini, naviqasiyanı, brauzer yaddaşını və istifadəçi qarşılıqlı təsirini idarə edir.

## Məhdudiyyətlər

Bu Vercel quruluşu etibarlı istehsal arxa tərəfi deyil, müştəri tərəfindəki demodur. `localStorage` istifadəçisi tərəfindən redaktə edilə bilər və bir brauzerə təcrid olunmuşdur; hesablar, rol iddiaları, inventar və satışlar cihazlar arasında sinxronizasiya olunmur. Klient tərəfindəki parol heşləməsi və rol yoxlamaları server tərəfindəki identifikasiyanı və ya avtorizasiyanı müəyyən etmir. Etibarlı serversiz API və verilənlər bazası əlavə etmədən real müştəri məlumatlarından, parollardan, ödənişlərdən və ya paylaşılan inventardan istifadə etməyin.
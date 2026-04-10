# Tahmin Macerası (Number Guessing Game) 🎮

Tahmin Macerası, oynayan kişilerin birbiriyle veya sistemi yöneten yapay zekaya (robota) karşı gizli sayı bulma yeteneklerini konuşturduğu, modern arayüzlü ve hızlı bir web tabanlı mobil uygulamadır (PWA).

![Uygulama Teması](logo.png)

## 🚀 Öne Çıkan Özellikler
- **Gerçekçi Tek Oyunculu Mod:** Robot rakip tamamen kusursuz tahminde bulunmaz, sınırları belirledikten sonra "insansı" bir hesaplamayla orta noktalara yakın tahminler yürütür. Kullanıcıya adaletli bir eğlence sunar.
- **Çok Oyunculu Mod (Oda Kur / Katıl):** WebSocket teknolojisine (Node.js vb.) yük bindirmeden, standart "HTTP Polling" iletişim tekniğini kullanarak arkadaşınızla gerçek zamanlı oynamanıza imkan tanır.
- **Sıfır Veritabanı Kurulumu (Zero-db):** Herhangi bir MySQL, MongoDB kurmanıza gerek yoktur. Odalar geçici olarak sadece `data/` klasöründe JSON formatıyla yaşar.
- **Otomatik Çöpçü (Self-Cleaning):** Sistemi yoran Cron-job görevlerine ihtiyaç olmaksızın, bir oyuncu sisteme her girişinde otomatik temizlik rutini tetiklenir ve kullanılmayan/biten oda JSON'ları (sunucuyu temiz tutmak için) 1 ve 10 dakika kurallarına göre anında silinir.
- **PWA (Native Uygulama Hissi):** Android veya iOS üzerinden "Ana Ekrana Ekle" özelliğiyle tıpkı Native bir uygulama gibi dikey tarayıcı barları olmadan, web sitesi esnemeleri (scroll bounce) kaldırılmış bir düzende çalışır.

## 🖥️ Kullanılan Teknolojiler
- **Ön Yüz (Frontend):** Vanilla JavaScript, HTML5, Saf CSS3 (Tailwind veya dış kütüphane kullanılmadan, cam/parlama-glassmorphism efektleri sıfırdan yazılmıştır).
- **Arka Yüz (Backend):** Saf PHP 7/8+ (Sadece `api.php`. Ek bir kuruluma ihtiyaç duymaz).

## 🛠️ Sunucuya Kurulum / Deployment
Sistemin çalışması için tek ihtiyacınız paylaşımlı (shared) cPanel/Plesk ortamı veya PHP kodlarını okuyabilen herhangi bir donanımdır.

1. Projedeki dosyaların tamamını web görünür dizininize (`public_html`, `www` veya `htdocs`) aktarın.
2. Klasör içerisinde bulunan `data` isimli klasörün okuma/yazma (CHMOD) izinlerinin doğru ve açık (`777` veya `755`) olduğundan emin olun ki PHP script'i odaları buraya başarıyla oluşturabilsin. (Eğer `data` klasörü yoksa PHP otomatik var edecektir).
3. Veritabanı veya karmaşık SQL bağlantıları ile uğraşmadan hemen uygulamanızın tarayıcı linkine giderek kullanmaya başlayın!

## 💡 Ekran Görüntüleri ve Oyun Döngüsü
- Oyuncular gizli sayılarını seçer (Örn: `1 - 1000` arası).
- Tahminde bulunduklarında sistem o tur için diğer oyuncuya seslenir ve tahmini büyükse **"Aşağı!"**, tahmini küçükse **"Yukarı!"** komutlarıyla yol gösterir.
- Diğerinin sayısını önce bulan oyuncu yarışı kazanır!

## 👨‍💻 Emeği Geçenler
Sıfırdan tasarlayıp kodlamanın tadını çıkararak geliştirilmiştir. Açık kaynaklı kullanıma uygundur, istediğiniz gibi fork'layıp dilediğinizce değiştirebilirsiniz.

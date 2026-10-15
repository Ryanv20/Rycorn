# AnyMile

Strateji oyunu hissinde, tarayıcıda çalışan 3D depo yönetim paneli. Kamyonlar yanaşır, forkliftler palet taşır, panel canlı güncellenir. Tüm veri simülasyondur; sunucu gerektirmez.

**Teknoloji:** Vite · React · TypeScript · Three.js (React Three Fiber + drei) · Zustand

## Geliştirme

```bash
npm install
npm run dev
```

## Production build

```bash
npm run build   # çıktı: dist/
npm run preview # build'i yerelde dene
```

`dist/` klasörü statik dosyalardan oluşur; Vercel, Netlify, Cloudflare Pages gibi herhangi bir statik barındırmaya konabilir.

## Yapı

| Klasör | İçerik |
|---|---|
| `src/sim/` | Simülasyon: dünya düzeni, kamyon/forklift mantığı, rota sistemi |
| `src/three/` | 3D sahne, modeller, kamera, seçim |
| `src/ui/` | Arayüz panelleri ve ikonlar |
| `src/store.ts` | Arayüz durumu (seçim, aktif depo, kamera komutları) |

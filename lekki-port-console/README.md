# Rycorn Port Console · Lekki

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

## Shared port construction grid and incidents

The Construct Viewer copies universal 10 m grid selections as reusable block
footprints. Use the same block size in Lekki and Los Angeles, then reposition
the selection for the other port's local grid origin. Any physical elements
that merge or overlap must be named and reported as an incident; do not leave
the overlap unreported. See [`../PORT_CONSTRUCTION_AND_INCIDENTS.md`](../PORT_CONSTRUCTION_AND_INCIDENTS.md).

## Yapı

| Klasör | İçerik |
|---|---|
| `src/sim/` | Simülasyon: dünya düzeni, kamyon/forklift mantığı, rota sistemi |
| `src/three/` | 3D sahne, modeller, kamera, seçim |
| `src/ui/` | Arayüz panelleri ve ikonlar |
| `src/store.ts` | Arayüz durumu (seçim, aktif depo, kamera komutları) |

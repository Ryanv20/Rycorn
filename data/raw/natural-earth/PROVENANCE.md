# Natural Earth Data

`ne_10m_land.zip` was retrieved on 2026-10-03 from the Natural Earth 1:10m
Physical Vectors land download (version 5.1.1). The Natural Earth web download
returned HTTP 500, so the official Natural Earth S3 mirror was used.

- Source page: https://www.naturalearthdata.com/downloads/10m-physical-vectors/10m-land/
- Download URL: https://naturalearth.s3.amazonaws.com/10m_physical/ne_10m_land.zip
- SHA-256: `e547d749445eaa0964aba76738090ec88f5e63c4585122170f98c67a7ea922dc`
- Coordinate reference: WGS 84 geographic coordinates (verified from `.prj`).
- Files: `ne_10m_land.shp`, `.shx`, `.dbf`, `.prj`, and accompanying release files.

Natural Earth describes this as land polygons derived from 10m coastline data.
It notes accuracy limitations in northern Russia and southern Chile. This is
generalized cartographic geometry, not navigational chart data. It can support
visual screening and model-level land-crossing checks, but cannot certify safe
navigation.

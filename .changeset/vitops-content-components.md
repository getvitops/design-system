---
'@getvitops/emdash': minor
---

`<VitopsContent components={…}>` takes `<PortableText>`'s `components` prop and forwards it to the text runs and to the blocks inside every band, so a site can override a block (`{ type: { vitops_hero: MyHero } }`) without losing the band support.

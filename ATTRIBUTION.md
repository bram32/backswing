# Credits and licences

Free Relief is built on other people's work. This file is the full notice; a short credit line
also appears in the app itself, under the swing lab, which is where the anatomy is on screen.

## Anatomy

> BodyParts3D, © The Database Center for Life Science licensed under CC Attribution 4.0
> International.

- Licence: [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)
- Database licence page: <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html>
- Original data: <https://dbarchive.biosciencedbc.jp/en/bodyparts3d/download.html>
- Source geometry: `isa_BP3D_4.0_obj_99.zip`, BodyParts3D 4.0
- Publication: Mitsuhashi N. et al. (2009), *BodyParts3D: 3D structure database for anatomical
  concepts*, Nucleic Acids Research. <https://doi.org/10.1093/nar/gkn613>

**Changes made.** This material has been modified. The BodyParts3D 4.0 meshes were first adapted
in the Human Atlas project: units and axes converted from millimetres/Z-up to metres/Y-up,
geometry simplified with meshoptimizer under a 0.2% per-structure relative error limit, normals
quantised to signed 16-bit, and the meshes packed into binary chunks. Free Relief then adapted
that work further: a subset of skeletal structures was selected (the twenty-four vertebrae, the
intervertebral discs, the sacrum, the hip bones, the ribcage and the sternum), the meshes were
simplified again and re-centred for real-time rendering on a phone, split and rigged for
animation, and re-coloured. No other changes were made to the underlying anatomy.

The adapted asset is `assets/anatomy/spine.bin`, produced by `tools/build-anatomy.mjs`.

**No warranty.** The BodyParts3D material is provided by its licensor as-is and as-available,
with no representations or warranties of any kind, and with liability excluded to the extent
possible, under Sections 5 and 6 of the Creative Commons Attribution 4.0 International licence.

**Scope.** BodyParts3D is an adult male reference anatomy based on TARO MRI data with anatomical
refinements. It does not represent every human structure or variation. The figure in Free Relief
is an illustration of how rotation is shared between the hips, the thoracic spine and the lumbar
spine. It is not a scan of you, not a measurement of you, and not a diagnostic tool.

**Availability.** The adapted geometry is served by the Free Relief web app over plain HTTPS with
no technological protection measure of any kind, so any recipient can obtain the exact adapted
asset unencumbered, whichever way they got the app.

## Software

Free Relief's 3D anatomy pipeline is derived from Human Atlas by ashemag
(<https://github.com/ashemag/human-atlas>), used under the MIT Licence.

```
MIT License

Copyright (c) 2026 ashemag

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

three.js — Copyright © 2010–present three.js authors, MIT Licence.
<https://github.com/mrdoob/three.js>

meshoptimizer — Copyright © 2016–present Arseny Kapoulkine, MIT Licence. Used upstream as a
build-time tool. <https://github.com/zeux/meshoptimizer>

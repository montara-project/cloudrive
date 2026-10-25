# Changelog

All notable changes to this project are documented in this file. Versions follow the git tags (`v*`); Docker images (api, docs) are published to ghcr.io with the same version.


## [0.4.0](https://github.com/montara-project/cloudrive/compare/v0.3.0...v0.4.0) (2026-10-25)

### ⚠ BREAKING CHANGES

* **api:** every API path previously served under /v1 now
  requires the /api prefix (/v1/me -> /api/v1/me, /health -> /api/health).

### Features

* **api:** mount every API endpoint under the /api prefix ([710fef4](https://github.com/montara-project/cloudrive/commit/710fef49db43edc5592354818d805aa09e054f39))
* **web:** add a sticky top bar and a single-line workspace switcher ([ee3bc63](https://github.com/montara-project/cloudrive/commit/ee3bc63646abbf7954bfd647f5898b91a9c68bf5))

### Bug Fixes

* **ci:** route the dispatch input through env and pin the react-doctor action ([bcf531c](https://github.com/montara-project/cloudrive/commit/bcf531c06e7df1a18ba88767d501fc55472dd661))
* **deps:** override vulnerable transitive packages flagged by pnpm audit ([e73c888](https://github.com/montara-project/cloudrive/commit/e73c8889a5267432d1a0c39a6ab2dcec6687eca5))
* **server:** add a CSP, HSTS, and dedicated rate limits ([36bb52b](https://github.com/montara-project/cloudrive/commit/36bb52bdfa2b23b06eeccb445ffe148c157aa5fe))
* **server:** bump dependencies flagged by govulncheck ([cf25bff](https://github.com/montara-project/cloudrive/commit/cf25bff88595e7afa41d85664ebf44a3b0fef887))
* **server:** enforce bucket root_prefix on the gateway data plane ([25e19bc](https://github.com/montara-project/cloudrive/commit/25e19bc8352f358724eacee9385f7b25487043f1))
* **server:** fix dropbox list continuation and multipart offsets ([3cc9fda](https://github.com/montara-project/cloudrive/commit/3cc9fda45704820a8876503e45b999dd7f3e49f1))
* **server:** harden the gdrive connector against traversal and lookup bugs ([045ef1d](https://github.com/montara-project/cloudrive/commit/045ef1d4cb926dcad1ccc1ffce11987377b7f3aa))
* **server:** harden the onedrive connector ([c36be66](https://github.com/montara-project/cloudrive/commit/c36be6686dc665201c97b110547d5ba2e7f003ed))
* **server:** keep secrets out of process argv in the ops Makefile ([0e3163f](https://github.com/montara-project/cloudrive/commit/0e3163fff115385e57acc2e0e2e5eb08f48b067f))
* **server:** make OAuth connect states single-use and request-scoped ([cfeb351](https://github.com/montara-project/cloudrive/commit/cfeb35116cabf04ef7c956480d6882e0c04e7804))
* **server:** make roles and super-user credentials operator-controlled ([7220644](https://github.com/montara-project/cloudrive/commit/7220644e0667592dd54a55ecd0b8116e7dc9da98))
* **server:** require admin to list invitations and redact their tokens ([cd08eab](https://github.com/montara-project/cloudrive/commit/cd08eabaa67a4b3ca1a5e23ab131f4da6d32fa3d))
* update debug config ([560c121](https://github.com/montara-project/cloudrive/commit/560c12171c00ac7aced48192843a461abf108254))
* update linter ([fa7b836](https://github.com/montara-project/cloudrive/commit/fa7b8364200888db51226eec6db86dcb95a22452))
* **web:** announce the active item and respect reduced motion ([882bb64](https://github.com/montara-project/cloudrive/commit/882bb64005556cfe1d60e93ef5367c70c9d9827f))
* **web:** keep the sidebar and page title usable on small screens ([a6bdbb1](https://github.com/montara-project/cloudrive/commit/a6bdbb1a2dade240638638b5d063b5b187b04c7f))
* **web:** namespace FolderArt SVG gradient and filter ids ([e2725a8](https://github.com/montara-project/cloudrive/commit/e2725a8895473e4dd99a4823f1430302534a5153))
* **web:** render member and owner tints in dark mode ([59a6588](https://github.com/montara-project/cloudrive/commit/59a658854ebe60b444c228980ac9dc481aff3b4a))

## [0.3.0](https://github.com/montara-project/cloudrive/compare/v0.2.0...v0.3.0) (2026-10-24)

### Features

* add better-auth skills ([2cd730d](https://github.com/montara-project/cloudrive/commit/2cd730d10662e213f57531b8c9d33a3a7007af4e))
* add license ([7893a28](https://github.com/montara-project/cloudrive/commit/7893a2846e4a5798f94752a9cd53ed259adf5a33))
* **app:** adopt the OneDrive brand palette ([5c70eb0](https://github.com/montara-project/cloudrive/commit/5c70eb0953c682d6691e9c12e7b7928969205673)), references [#0078D4](https://github.com/montara-project/cloudrive/issues/0078D4) [#1490DF](https://github.com/montara-project/cloudrive/issues/1490DF) [#28A8EA](https://github.com/montara-project/cloudrive/issues/28A8EA)
* **app:** move the account menu to the top bar ([06d8029](https://github.com/montara-project/cloudrive/commit/06d80293986a67ca1f293bacfa89a9d69c16a2d3))
* **app:** redesign dashboard to match the reference layout ([16e98b9](https://github.com/montara-project/cloudrive/commit/16e98b9013e354f5b0eb8d0898d27a9ab6309c98))
* **app:** regroup sidebar into a Drive group ([7670aea](https://github.com/montara-project/cloudrive/commit/7670aea86c7849d484d8e60022d58951d4016cd8))
* **docs:** serve the docs at the site root ([2e4827c](https://github.com/montara-project/cloudrive/commit/2e4827ccb9407ff787d0c80676e3c5738e622460))
* implementation onboarding ([1102e13](https://github.com/montara-project/cloudrive/commit/1102e133ff413b2b2d3cb90b6dfe176f2c18e19a))
* **server:** serve the web SPA from the API image ([4a10df7](https://github.com/montara-project/cloudrive/commit/4a10df7a0111fdf73a290b65cdb0123ad1167d96))
* update web app ([89d1669](https://github.com/montara-project/cloudrive/commit/89d1669e2750d1701113ed90257b831e3ef01419))
* **web:** share the dashboard layout and move the S3 gateway into settings ([0e1bc12](https://github.com/montara-project/cloudrive/commit/0e1bc12afd437ea3830777db73d21d0f40f17784))

### Bug Fixes

* **app:** make sonner toasts readable in both themes ([874efac](https://github.com/montara-project/cloudrive/commit/874efac87428cd34a302905a2973492067af71f2))
* change cloudrive logo ([527a622](https://github.com/montara-project/cloudrive/commit/527a622917010f8186f21dec408553bc58642e0b))
* **docs:** add the favicon, manifest and brand logo ([d1e4d5a](https://github.com/montara-project/cloudrive/commit/d1e4d5ae94b030f13249564f18815e9e405360de))
* update agents skills ([139fedc](https://github.com/montara-project/cloudrive/commit/139fedc066912cc34ab634ad2853fd1adeea1df7))
* update api layers ([d24dd10](https://github.com/montara-project/cloudrive/commit/d24dd10fae93c2cd9fe3e36536bfa8dfa3581e0c))
* update auth session with better auth ([424deaa](https://github.com/montara-project/cloudrive/commit/424deaa4cb1134a5235ef173b98fb23b092997e5))
* update authula expires_at ([4df2cb7](https://github.com/montara-project/cloudrive/commit/4df2cb73214b870845e781347ec457c037b1150f))
* update bearer auth ([15c7fc3](https://github.com/montara-project/cloudrive/commit/15c7fc3de955b499a7170dcfb0c99981b2c51194))
* update block components ([1688da9](https://github.com/montara-project/cloudrive/commit/1688da9988b4c9bc3092c7c09a6d873ffe974b03))
* update block components ([52fbb96](https://github.com/montara-project/cloudrive/commit/52fbb961d77f74c00323065fdfa156a113686e87))
* update brand logo ([5b87b67](https://github.com/montara-project/cloudrive/commit/5b87b67c804c76c46546c479aa5ae9da8bc53b41))
* update cloudrive ([b29a125](https://github.com/montara-project/cloudrive/commit/b29a125eb753f86b7b900e644ae101adc09489d5))
* update css ([86adc81](https://github.com/montara-project/cloudrive/commit/86adc81afb45419c3ef08fe1ce395b838caa425a))
* update global css ([0ee7bbe](https://github.com/montara-project/cloudrive/commit/0ee7bbe207a8f3fd758385135117b45b53232cc7))
* update login page ([19ecd14](https://github.com/montara-project/cloudrive/commit/19ecd14c29e1f86815a057ac5deb4474c3edffd2))
* update migrate on boot ([d5f63b3](https://github.com/montara-project/cloudrive/commit/d5f63b38707bdd353c14c664991f8fcf308ed412))
* update organization layers and structure ([6a9fa52](https://github.com/montara-project/cloudrive/commit/6a9fa524e26a13309e31b4fe59c5a7c4092e9bfc))
* update organization query ([a7324b5](https://github.com/montara-project/cloudrive/commit/a7324b57c85ffe821a18a29e4c7e5bb9043f6146))
* update query offset ([0889491](https://github.com/montara-project/cloudrive/commit/0889491ea5817abf45895575175fa3d5ac399f16))
* update s3 api port ([be15fbc](https://github.com/montara-project/cloudrive/commit/be15fbc7b4ffec11b4917cace0e9935afaaf8111))
* update selected organization ([92fe585](https://github.com/montara-project/cloudrive/commit/92fe58588a13467044bdb2b6dc4da27a034841ae))
* update sidebar ([1744478](https://github.com/montara-project/cloudrive/commit/174447820ffd436cf5c5cb6d90046c43b2ecc381))
* update sidebar logo ([b9f7ff7](https://github.com/montara-project/cloudrive/commit/b9f7ff79baf2afc092d5a097e074068a870775a0))
* update sidebar menu ([b7f52cf](https://github.com/montara-project/cloudrive/commit/b7f52cf400e274508d78c9e77ae5ac16ec1a13dd))
* update skill graft ([b5b7a35](https://github.com/montara-project/cloudrive/commit/b5b7a35501bff6454255b926d51b68c2cf61785f))
* update storage account ([d8aed01](https://github.com/montara-project/cloudrive/commit/d8aed010a107725d8a9ce00e9588e0ca5c118db6))
* update storage account oauth ([6220fc3](https://github.com/montara-project/cloudrive/commit/6220fc337d40becc5a6aa01030f5018c98e146fd))
* update web ([c97b907](https://github.com/montara-project/cloudrive/commit/c97b907bb83640aa450f212b7d6a2e24e6d186ed))
* **web:** update font & hydrate app ([e4a99f7](https://github.com/montara-project/cloudrive/commit/e4a99f7b296455b0152ed59571c7abea03139934))
* **web:** update minor ([387c1ef](https://github.com/montara-project/cloudrive/commit/387c1efd2f7e34b2160c12e47743c6ede608e82a))

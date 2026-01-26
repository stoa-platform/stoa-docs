# 🎯 Script Démo ENGIE — Mercredi 29 Janvier 2026

**Audience:** Techos IA + Archi + Décideur
**Durée:** 30 min
**Enjeu:** Go/No-Go existence projet STOA

---

## ⚡ Pitch d'ouverture (30 sec)

> "Les API Gateways ont été conçus pour les développeurs humains.
> STOA est le premier gateway conçu pour les agents IA.
> Un contrat, tous les protocoles.
> Souverain, européen, open-source Apache 2.0."

---

## 🛡️ Objections & Réponses (`<30 sec` chacune)

### "Pourquoi pas Kong/Apigee ?"

> "Kong optimise le 'Time To First API Call' — combien de temps pour qu'un dev humain appelle votre API.
> STOA optimise le 'Time To First Agent Call' — combien de temps pour qu'un agent IA utilise vos APIs.
> Avec MCP natif, vos APIs sont consommables par Claude, GPT, ou Mistral en 5 minutes, pas 5 jours."

### "C'est open-source, on peut forker"

> "Absolument, c'est Apache 2.0. Mais vous perdez :
> - Les patches sécurité en 24h au lieu de la disclosure publique
> - L'influence sur la roadmap
> - La certification officielle pour vos auditeurs
> - Un expert qui a construit l'APIM de la Banque de France
>
> Vos devs passeront 6 mois à comprendre ce que je peux expliquer en 2 jours.
> Le fork vous coûtera plus cher que le partenariat."

### "T'es tout seul, c'est un risque"

> "Je suis seul avec Claude, et je livre 4x plus vite qu'une équipe de 4.
> Le code est open-source — si je disparais demain, vous avez tout.
> Mais je ne disparais pas : 7 ans à la Banque de France,
> société établie depuis 2012, et STOA est mon projet de vie."

### "Pas de références production"

> "Exact. C'est pour ça que je cherche des design partners, pas des clients.
> Vous influencez la roadmap, vous avez un tarif fondateur,
> et dans 12 mois vous êtes la référence que tout le monde cite.
> Premier arrivé, premier servi."

### "On a déjà webMethods/Axway"

> "Parfait, gardez-le. STOA ne remplace pas votre gateway critique.
> STOA se met DEVANT pour :
> - Exposer vos APIs existantes en MCP pour les agents IA
> - Ajouter l'observabilité AI-native (tokens, coûts, latence)
> - Tester de nouveaux patterns sans toucher au legacy
>
> Vous gardez votre investissement, vous ajoutez les capacités IA."

### "C'est quoi le business model ?"

> "Open-core façon Kubernetes :
> - Community : Gratuit, Apache 2.0, tout le core
> - Pro : 500€/mois — support prioritaire, patches sécurité privés
> - Enterprise : 2000€/mois — SLA 24h, architecture review, certification
> - Design Partner : Sur mesure — vous influencez la roadmap"

### "MCP c'est un standard Anthropic, pas neutre"

> "MCP est open-source, MIT license, avec une spec publique.
> C'est le seul standard qui a du traction — OpenAI l'adopte, Microsoft l'intègre.
> Attendre un 'standard neutre' c'est attendre Godot.
> Et STOA est LLM-agnostic : Claude, GPT, Mistral, Llama — vous choisissez."

### "Souveraineté, c'est du marketing"

> "Non. Avec STOA :
> - Déploiement on-premise ou cloud EU (OVH, Scaleway)
> - Aucune donnée obligée de sortir de votre périmètre
> - LLM au choix : Mistral (français), ou self-hosted Llama
> - Pas de CLOUD Act, pas de dépendance US
>
> Montrez-moi un autre Agent Gateway qui peut dire ça."

---

## 🎬 Déroulé Démo (25 min)

### 1. Hook IA (3 min)
- Ouvrir Claude Desktop
- Montrer MCP connecté à STOA
- "Quelles APIs sont disponibles ?" → Liste instantanée
- **Point:** L'agent voit vos APIs comme des outils natifs

### 2. UAC = Un Contrat, Tous les Protocoles (5 min)
- Montrer un fichier UAC YAML
- "Ce contrat expose automatiquement en REST, GraphQL, MCP"
- Comparer avec la config Kong/Apigee équivalente (3x plus de fichiers)
- **Point:** Productivité dev x3

### 3. Multi-tenant Isolation (5 min)
- Montrer 3 tenants : Parzival, Sorrento, Halliday (Ready Player One)
- Chaque tenant ne voit QUE ses APIs
- Tenter d'accéder aux APIs d'un autre tenant → Rejeté
- **Point:** Sécurité enterprise-grade

### 4. Observabilité AI-Native (5 min)
- Dashboard Grafana
- Métriques : tokens consommés, coût par requête, latence P99
- Alertes : budget dépassé, rate limit atteint
- **Point:** Vous contrôlez vos coûts IA

### 5. GitOps & Governance (5 min)
- Modifier un UAC dans Git
- ArgoCD détecte, déploie automatiquement
- Audit trail complet : qui, quoi, quand
- **Point:** Compliance-ready (NIS2, DORA)

### 6. Q&A (7 min)
- Questions ouvertes
- Identifier le décideur et ses concerns
- Proposer next step : POC 2 semaines

---

## ✅ Checklist Pré-Démo

### Infra (vérifier lundi soir)
- [ ] portal.gostoa.dev accessible
- [ ] mcp.gostoa.dev répond
- [ ] Grafana dashboards chargés
- [ ] 3 tenants RPO configurés (Parzival, Sorrento, Halliday)
- [ ] 12 APIs visibles par tenant

### Claude Desktop
- [ ] MCP STOA connecté
- [ ] Test "list tools" fonctionne
- [ ] Test appel API fonctionne

### Slides backup
- [ ] PDF architecture (si démo plante)
- [ ] Screenshots Grafana
- [ ] Diagram UAC → Multi-protocole

### Logistique
- [ ] Lien visio confirmé
- [ ] Backup connexion (4G)
- [ ] Eau, café ☕

---

## 🎯 Objectif Sortie Meeting

**Minimum:** "Intéressant, on en reparle en février"
**Target:** "On veut un POC de 2 semaines"
**Stretch:** "On signe un design partnership"

---

## 📞 Next Steps à Proposer

1. **POC 2 semaines** — On expose 3 de vos APIs en MCP
2. **Architecture workshop** — 1 jour on-site, on dessine votre cible
3. **Design partner agreement** — Tarif fondateur, influence roadmap

*"Vous préférez commencer par quoi ?"*

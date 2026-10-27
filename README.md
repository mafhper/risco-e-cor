# Risco e Cor

App Android de desenho e colorir para crianças, feito para funcionar offline.

## Estado

Pré-MVP. O projeto está em desenvolvimento e reúne duas partes:

- `android/` — o app Android.
- `mockup/` — um protótipo web, usado para explorar a interface antes de levar as telas para o app.

Nenhuma das duas partes está pronta para uso. As pastas chegam ao repositório conforme a migração do protótipo avança; os comandos abaixo valem a partir daí.

## Como rodar

### `android/`

Requer JDK e Android SDK configurados na máquina.

```bat
cd android
gradlew.bat assembleDebug
```

O APK de debug sai dentro da pasta de build do módulo.

### `mockup/`

Requer Node.js com `npm`.

```bash
cd mockup
npm ci
npm run dev
```

O endereço local aparece no terminal quando o servidor de desenvolvimento sobe.

## Aviso

O repositório está em obras: estrutura, pastas e comandos ainda podem mudar sem aviso. As condições de uso de conteúdo de terceiros estão em `CREDITS.md`.

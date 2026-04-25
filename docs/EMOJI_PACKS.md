# Descargar packs de emojis desde GitHub

Script incluido:

- `C:\BOT_HackLabH\scripts\download_emoji_pack.py`

## Requisitos

- Python 3
- Pillow para redimensionar (recomendado):

```powershell
pip install pillow
```

## Uso rápido (Twemoji)

```powershell
npm run emoji:pack
```

Esto descarga emojis de `twitter/twemoji`, los prepara en 128x128 y los guarda en:

- `C:\BOT_HackLabH\assets\emojis\twemoji`

También genera comandos sugeridos en:

- `C:\BOT_HackLabH\assets\emojis\upload_commands.txt`

## Pack divertido (sin banderas)

```powershell
npm run emoji:fun
```

Genera:

- `C:\BOT_HackLabH\assets\emojis\fun_pack`
- `C:\BOT_HackLabH\assets\emojis\upload_commands_fun.txt`

## Uso personalizado

```powershell
python scripts/download_emoji_pack.py --repo twitter/twemoji --branch master --path assets/72x72 --out assets/emojis/twemoji --limit 300
```

Con filtro divertido:

```powershell
python scripts/download_emoji_pack.py --profile fun --out assets/emojis/fun_pack --commands-file assets/emojis/upload_commands_fun.txt --limit 300 --clean-out
```

## Subir con el bot

Comandos disponibles:

- `!emoji add <nombre> <url-imagen>`
- `!emoji addfile <nombre>` (adjuntando imagen)
- `!emoji delete <nombre>`
- `!emoji list`
- `!emoji app_list`
- `!emoji use <nombre> [fallback]`

> Nota: Discord exige 256KB máx por emoji. El script avisa si alguno supera ese tamaño.

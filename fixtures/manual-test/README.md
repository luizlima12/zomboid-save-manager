# Save de teste manual

Use `ZSM_TEST_SAVE.zip` para validar o modo web privado.

Conteúdo esperado:

- `Luiz Felipe` — morto (`isDead = 1`), disponível para recuperação;
- `Mara Voss` — viva (`isDead = 0`), deve ser recusada pela recuperação;
- `players.db` com `PRAGMA integrity_check = ok`;
- `map_ver.bin` e arquivos de mapa mínimos para a validação estrutural.

Este arquivo é uma fixture sintética para testar importação, backup e Character Recovery. Ele não representa um mundo jogável no Project Zomboid.

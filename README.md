# Zomboid Save Manager

Aplicação local para Windows que detecta saves do Project Zomboid e cria backups verificados sem expor caminhos de filesystem às operações do navegador.

## Executar

```powershell
npm install
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000). Na primeira execução, a aplicação procura saves em `%USERPROFILE%\Zomboid\Saves` e grava configuração/metadados em `%USERPROFILE%\ZomboidSaveManager`.

## Marco implementado

- Next.js App Router, TypeScript estrito, Tailwind e componentes shadcn-style;
- Departure Mono oficial v1.500 local;
- configuração local em JSON;
- detecção dinâmica de modos e saves;
- seleção de save;
- backup manual atômico com validação de tamanho, arquivos e diretórios;
- histórico de backups;
- lock de operação e IDs opacos no cliente.
- scanner compatível com `localPlayers` e `networkPlayers`;
- recuperação transacional de personagens mortos;
- backup completo e backup separado de `players.db` antes da recuperação;
- rollback do banco para o estado pré-recuperação;
- Recovery Mod de execução única para restaurar HP e remover ferimentos e infecção.

## Recuperar um personagem

1. Feche o Project Zomboid.
2. Selecione o save na dashboard e abra **Personagens**.
3. Escolha o personagem morto e o modo de recuperação.
4. Confirme a operação. A aplicação cria e valida os backups antes da transação.
5. Para o modo saudável, habilite **Zomboid Save Manager Recovery** no menu Mods e carregue exatamente o save indicado.

O mod confere mundo e nome do personagem, executa uma única vez e é desativado pela aplicação após o marcador de conclusão aparecer em `console.txt`.

O launcher geral e a tela de restore de backups completos continuam reservados para os próximos marcos. O rollback da recuperação já está disponível e restaura o `players.db` preservado antes da operação.

## Verificar

```powershell
npm run typecheck
npm run lint
npm test
npm run build
```

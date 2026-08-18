# Como a rede é protegida

O que este projeto garante, como garante, e — igualmente importante — **o que
ele não garante**.

---

## O resumo honesto

| O que | Protegido de quem |
| --- | --- |
| Mensagens do chat | De todos, inclusive do servidor |
| Áudios, fotos e vídeos do chat | De todos, inclusive do servidor |
| Chamadas de voz e vídeo | De todos, inclusive do servidor e do TURN |
| Senhas | De quem roubar o banco de dados |
| Posts do feed | De quem roubar o disco, e de membros sem permissão — **mas não do servidor** |
| Quem falou com quem, e quando | **De ninguém.** O servidor precisa saber para entregar |

---

## O chat: ponta-a-ponta de verdade

Cada aparelho gera um par de chaves quando é cadastrado. **A chave privada nunca
sai dele** — o servidor recebe só a pública.

Cada conversa tem uma chave própria, que é *selada* individualmente para a chave
pública de cada aparelho participante. O servidor guarda esses envelopes selados
e não consegue abrir nenhum, porque não tem nenhuma das chaves privadas.

As mensagens são cifradas com XChaCha20-Poly1305. Junto com o texto vai
autenticado o **contexto** — qual conversa, quem escreveu, qual época, que
horas. Se alguém tentar pegar uma mensagem e injetá-la noutra conversa, ou fingir
que outra pessoa a escreveu, ela não abre.

Há um teste automatizado que verifica exatamente isso: ele monta o pacote que
sai do aparelho e afirma que o texto original não aparece em lugar nenhum dele.

### Épocas

Quando alguém entra ou sai de uma conversa, ou quando um aparelho é revogado,
abre-se uma **época nova** com chave nova. Quem saiu não lê o que vem depois.

**Limite honesto:** quem já tinha a chave de uma época continua conseguindo ler
as mensagens daquela época. Isto não é o *ratchet duplo* do Signal, que troca a
chave a cada mensagem. É um compromisso consciente entre segurança e
complexidade — e vale saber que existe.

---

## As senhas

Guardadas com **Argon2id**, que é lento de propósito e consome bastante memória.
Cada tentativa de adivinhação custa caro, o que transforma um ataque de força
bruta viável num inviável.

Cada senha tem um sal próprio, sorteado na hora, então duas pessoas com a mesma
senha produzem hashes completamente diferentes.

O mínimo é 12 caracteres, sem exigir "uma maiúscula e um símbolo". Regras de
composição empurram todo mundo para `Senha@123`, que é péssima; comprimento é o
que de fato encarece um ataque. Uma frase curta funciona muito melhor.

---

## As chamadas

O WebRTC já cifra áudio e vídeo ponta-a-ponta, com DTLS-SRTP. Isso vale mesmo
quando a chamada precisa passar pelo TURN: ele repassa pacotes que não consegue
abrir.

Além disso, a negociação da chamada trafega cifrada com a chave da conversa, e o
*fingerprint* da conexão é assinado — assim nem o próprio servidor consegue se
colocar no meio.

---

## O feed: aqui a proteção é diferente

**Os posts do feed não são ponta-a-ponta**, e isso é uma decisão consciente, não
um esquecimento.

Um post dirigido ao círculo "Família" teria de ser recifrado para cada pessoa a
cada entrada e saída do círculo. Na prática isso é frágil, caro e quebra em
silêncio quando alguém troca de aparelho.

A proteção do feed é outra:

- **Controle de acesso rígido** — o servidor só entrega o que aquela pessoa pode
  ver, conferido a cada requisição.
- **Mídias cifradas em repouso**, com AES-256-GCM. Quem roubar o disco não abre.
- **Nada acessível por link direto**: os arquivos saem por URL assinada de curta
  duração.

Ou seja: o feed protege contra roubo do disco e contra membros bisbilhoteiros.
**Não protege do servidor.** Quem quiser sigilo de verdade usa o chat.

---

## O que a rede não esconde — os metadados

O servidor **precisa** saber, para funcionar:

- quem tem conta;
- quem participa de qual conversa;
- que houve uma mensagem, de quem para qual conversa, e quando;
- o tamanho aproximado de cada mensagem;
- quem ligou para quem, e por quanto tempo.

Ele não sabe o **conteúdo** de nada disso. Mas se o servidor cair em mãos
erradas, o padrão de quem fala com quem e a que horas fica visível.

Esconder metadados de verdade exige coisas como tráfego de cobertura e
roteamento em camadas — o que tornaria a rede muito mais lenta e complexa, sem
benefício real para o caso de uso aqui. Fica registrado como limite conhecido.

---

## Captura de tela

**Não dá para impedir de forma confiável.** O app Android ativa `FLAG_SECURE`,
que bloqueia print dentro dele, e isso já cobre o descuido comum.

Mas ninguém consegue impedir que alguém fotografe a tela com outro celular. Vale
para esta rede, para o WhatsApp e para o Signal.

**Mensagem temporária protege contra descuido, não contra má-fé.** Se você não
confia na pessoa do outro lado, nenhuma tecnologia resolve isso.

---

## O acesso

- **Só por convite.** Sem um código válido, ninguém cria conta. A rede é
  invisível para quem não foi chamado.
- **Convites vencem** e têm limite de usos.
- **Sessões duram pouco**, e o token de renovação é trocado a cada uso — se um
  vazar e for usado, o legítimo é derrubado e você percebe.
- **Cada aparelho é revogável** individualmente.
- **PIN ou biometria** para destravar o app no celular.

---

## O que não protegemos, e você deve

**Um aparelho comprometido derruba tudo.** Se alguém tem acesso ao seu celular
desbloqueado, ou instalou um programa espião nele, a criptografia não ajuda —
ela protege a mensagem em trânsito e em repouso, não a tela que você está
olhando.

Então:

- Use bloqueio de tela no celular.
- Mantenha o Android atualizado.
- Não instale APK de origem duvidosa.
- No PC que hospeda a rede, mantenha o Windows atualizado.

---

## O backup é a única cópia

Vale repetir, porque é a consequência mais séria de todas as escolhas acima:
**o servidor não consegue reconstruir nenhuma mensagem.** Não há chave guardada
em lugar nenhum para isso.

Se o banco de dados se perder e não houver backup, as conversas se perderam. Não
existe suporte, nuvem ou técnico que traga de volta.

Por isso o backup é automático, e por isso vale testar a restauração uma vez com
calma — antes de precisar dela com pressa.

---

## Encontrou uma falha?

Abra uma issue no repositório. Se for algo sensível, descreva o problema sem
publicar o passo a passo da exploração até haver correção.

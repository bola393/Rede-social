import { useId } from 'react';

/**
 * As peças que se repetem em toda tela.
 *
 * Ficam juntas para que botão e campo tenham sempre a mesma altura, o mesmo
 * arredondamento e o mesmo comportamento ao toque — e para que corrigir o
 * tamanho do alvo de toque seja uma mudança só.
 */

export function Botao({
  children,
  variante = 'principal',
  carregando = false,
  ...resto
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variante?: 'principal' | 'secundario' | 'perigo';
  carregando?: boolean;
}) {
  const estilo = {
    principal: 'bg-destaque text-white active:bg-destaque/80',
    secundario: 'border border-borda bg-superficie active:bg-superficie-alta',
    perigo: 'border border-ruim/40 text-ruim active:bg-ruim/10',
  }[variante];

  return (
    <button
      // min-h-12 não é enfeite: alvo de toque menor que isso faz errar o dedo.
      className={`min-h-12 w-full rounded-xl px-4 text-[15px] font-medium transition-colors disabled:opacity-50 ${estilo}`}
      disabled={carregando || resto.disabled}
      {...resto}
    >
      {carregando ? 'Aguarde…' : children}
    </button>
  );
}

export function Campo({
  rotulo,
  erro,
  dica,
  ...resto
}: React.InputHTMLAttributes<HTMLInputElement> & {
  rotulo: string;
  erro?: string | undefined;
  dica?: string | undefined;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm font-medium">
        {rotulo}
      </label>
      <input
        id={id}
        aria-invalid={erro ? true : undefined}
        aria-describedby={erro || dica ? `${id}-aviso` : undefined}
        className={`bg-superficie focus:border-destaque min-h-12 rounded-xl border px-3.5 text-[16px] outline-none transition-colors ${
          erro ? 'border-ruim' : 'border-borda'
        }`}
        {...resto}
      />
      {(erro || dica) && (
        <p id={`${id}-aviso`} className={`text-[13px] ${erro ? 'text-ruim' : 'text-texto-suave'}`}>
          {erro ?? dica}
        </p>
      )}
    </div>
  );
}

export function Aviso({
  children,
  tom = 'atencao',
}: {
  children: React.ReactNode;
  tom?: 'atencao' | 'ruim' | 'bom';
}) {
  const estilo = {
    atencao: 'border-atencao/30 bg-atencao/10 text-atencao',
    ruim: 'border-ruim/30 bg-ruim/10 text-ruim',
    bom: 'border-bom/30 bg-bom/10 text-bom',
  }[tom];

  return (
    <p
      role={tom === 'ruim' ? 'alert' : undefined}
      className={`rounded-xl border px-3.5 py-3 text-[13px] leading-relaxed ${estilo}`}
    >
      {children}
    </p>
  );
}

export function Cabecalho({ titulo, descricao }: { titulo: string; descricao?: string }) {
  return (
    <header className="flex flex-col gap-2">
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      {descricao && <p className="text-texto-suave text-[15px] leading-relaxed">{descricao}</p>}
    </header>
  );
}

export function Tela({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col gap-6 px-5 py-8">{children}</main>
  );
}

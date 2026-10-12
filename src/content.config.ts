import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';
import registroDeConceitos from './data/conceitos.json';
import { conceitosInvalidos } from './lib/aprendizagem/conceitos';

// Ids de conceito (`<matéria>/<conceito>`) precisam estar em src/data/conceitos.json: id errado quebra o build.
const conceitosSchema = z
  .array(z.string())
  .default([])
  .superRefine((ids, ctx) => {
    const ruins = conceitosInvalidos(ids, registroDeConceitos);
    if (ruins.length) ctx.addIssue({ code: 'custom', message: `conceito não cadastrado em src/data/conceitos.json: ${ruins.join(', ')}` });
  });

// Bloco opcional de recursos extras de uma aula (vídeo aula, curso gratuito,
// materiais adicionais, conteúdo complementar). Cada seção é independente —
// só renderiza no site se estiver preenchida no frontmatter.
const resourcesSchema = z.object({
  videoAula: z
    .object({
      link: z.string(),
      duracao: z.string().optional(),
      motivo: z.string().optional(), // por que assistir
    })
    .optional(),
  cursoGratuito: z
    .object({
      link: z.string(),
      cargaHoraria: z.string().optional(),
      indicadoPara: z.string().optional(), // ex: "iniciante", "revisão", "avançado"
    })
    .optional(),
  materiaisAdicionais: z
    .object({
      ebook: z.string().optional(),
      exercicios: z.string().optional(),
      provaAntiga: z.string().optional(),
      outro: z.string().optional(),
      nivel: z.string().optional(), // ex: "fácil", "médio", "difícil"
    })
    .optional(),
  conteudoComplementar: z
    .object({
      conteudo: z.string(),
      comoAjuda: z.string().optional(),
    })
    .optional(),
});

// Gabarito das questões da aula ("Questões do ENEM" ou, na Redação, "Questões e escrita").
// As questões continuam escritas em markdown no corpo da aula; aqui fica só a
// resposta certa de cada uma (índice 0-4 = alternativas a-e) e, quando vale a
// pena, uma linha explicando o porquê. O quiz é montado no navegador a partir
// do HTML já renderizado, então adicionar gabarito não exige reescrever aula.
// Recomendação mostrada quando o estudante erra a questão: aula do próprio site e o motivo, em texto.
const recomendarSchema = z.object({
  aula: z.string().regex(/^(enem|escolar|ds)\/[a-z0-9-]+\/[a-z0-9-]+$/), // id da aula; validar-aula confere se existe
  titulo: z.string(), // nome da aula, para o link; validar-aula confere com o título dela
  porque: z.string().min(10),
});

const gabaritoSchema = z.object({
  correta: z.number().min(0).max(4),
  porque: z.string().optional(),
  conceitos: conceitosSchema, // o que a questão avalia; alimenta o estado do conceito
  recomendar: recomendarSchema.optional(),
});

// Cartão de revisão escrito à mão: pergunta curta, resposta sem ambiguidade, ligado a um conceito.
// O id é único na aula; o id global do cartão é "<id da aula>/<id do cartão>".
const cartoesSchema = z
  .array(
    z.object({
      id: z.string().regex(/^[a-z0-9-]+$/),
      tipo: z.enum(['pergunta', 'lacuna', 'verdadeiro-falso']),
      frente: z.string().min(10),
      verso: z.string().min(3),
      conceito: z.string(),
    })
  )
  .default([])
  .superRefine((cartoes, ctx) => {
    const ids = cartoes.map((c) => c.id);
    if (new Set(ids).size !== ids.length) ctx.addIssue({ code: 'custom', message: 'ids de cartão repetidos na mesma aula' });
    const ruins = conceitosInvalidos(cartoes.map((c) => c.conceito), registroDeConceitos);
    if (ruins.length) ctx.addIssue({ code: 'custom', message: `conceito não cadastrado em src/data/conceitos.json: ${ruins.join(', ')}` });
  });

// Ferramentas para acompanhar e praticar a aula (programas, contas, materiais). Cada item vira
// uma linha no bloco "Ferramentas para esta aula"; sem a lista, o bloco não aparece.
const ferramentaSchema = z.object({
  nome: z.string(),
  uso: z.string(), // para que serve nesta aula
  custo: z.string().optional(), // ex.: "Gratuito", "US$ 25, uma vez"
  link: z.string().url().optional(), // página oficial
  opcional: z.boolean().default(false), // false = precisa para acompanhar a aula
});

// Schema compartilhado pelas 3 coleções (enem, escolar, ds).
const lessonSchema = z.object({
  title: z.string(),
  subject: z.string(),
  relevance: z.string(),
  quickSummary: z.string().optional(), // resumo rápido de 2-4 linhas, direto ao ponto
  order: z.number().default(1),
  conceitos: conceitosSchema, // o que a aula ensina
  cartoes: cartoesSchema,
  gabarito: z.array(gabaritoSchema).optional(),
  resources: resourcesSchema.optional(),
  ferramentas: z.array(ferramentaSchema).optional(),
});

// ENEM: matéria -> tema (sem bimestre/semana)
const enem = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/enem' }),
  schema: lessonSchema,
});

// Escolar: matéria -> bimestre -> semana -> tema
const escolar = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/escolar' }),
  schema: lessonSchema,
});

// DS: matéria -> bimestre -> semana -> tema
const ds = defineCollection({
  loader: glob({ pattern: '**/*.mdx', base: './src/content/ds' }),
  schema: lessonSchema,
});

export const collections = { enem, escolar, ds };

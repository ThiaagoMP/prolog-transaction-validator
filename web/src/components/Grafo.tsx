import cytoscape from 'cytoscape'
import { useEffect, useRef } from 'react'
import type { Achado, Transacao } from '../server/funcoes'

const TEXTO = '#162224'
const TEXTO_2 = '#55666a'
const LINHA = '#b3c0c1'
const SUPERFICIE = '#ffffff'
const PERIGO = '#b42318'
const ALERTA = '#c27a12'
const FONTE = "'Fira Sans', system-ui, sans-serif"

const compacto = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
}).format

type Props = { transacoes: Transacao[]; achados: Achado[]; contasRisco: string[] }

export function Grafo({ transacoes, achados, contasRisco }: Props) {
  const div = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const emCiclo = new Set(achados.flatMap((a) => (a.regra === 'ciclo' ? a.transacoes : [])))
    const comAchado = new Set(achados.flatMap((a) => (a.regra === 'ciclo' ? [] : [a.transacao])))
    const risco = new Set(contasRisco)
    const contas = new Set(transacoes.flatMap((t) => [t.origem, t.destino]))

    const cy = cytoscape({
      container: div.current,
      elements: [
        ...[...contas].map((c) => ({
          data: { id: 'c:' + c, rotulo: c },
          classes: risco.has(c) ? 'risco' : '',
        })),
        ...transacoes.map((t) => ({
          data: {
            id: 't:' + t.id,
            source: 'c:' + t.origem,
            target: 'c:' + t.destino,
            rotulo: `${t.id.split('/').pop()} ${compacto(t.valor)}`,
          },
          classes: [comAchado.has(t.id) && 'com-achado', emCiclo.has(t.id) && 'ciclo']
            .filter(Boolean)
            .join(' '),
        })),
      ],
      style: [
        {
          selector: 'node',
          style: {
            label: 'data(rotulo)',
            'background-color': TEXTO_2,
            color: TEXTO,
            'font-family': FONTE,
            'font-size': 13,
            'font-weight': 600,
            'text-valign': 'top',
            'text-margin-y': -5,
            width: 18,
            height: 18,
          },
        },
        {
          selector: 'node.risco',
          style: {
            shape: 'diamond',
            'background-color': TEXTO,
            width: 24,
            height: 24,
          },
        },
        {
          selector: 'edge',
          style: {
            label: 'data(rotulo)',
            width: 1.5,
            'line-color': LINHA,
            'target-arrow-color': LINHA,
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            color: TEXTO_2,
            'font-family': FONTE,
            'font-size': 11,
            'text-background-color': SUPERFICIE,
            'text-background-opacity': 0.9,
            'text-background-padding': '2px',
          },
        },
        {
          selector: 'edge.com-achado',
          style: { 'line-color': ALERTA, 'target-arrow-color': ALERTA, 'line-style': 'dotted', width: 2.5 },
        },
        {
          selector: 'edge.ciclo',
          style: {
            'line-color': PERIGO,
            'target-arrow-color': PERIGO,
            'line-style': 'dashed',
            'line-dash-pattern': [10, 4],
            width: 3,
            color: PERIGO,
            'font-weight': 600,
          },
        },
      ],
      layout: { name: 'circle' },
    })
    cy.layout({
      name: 'cose',
      randomize: false,
      animate: false,
      padding: 28,
      idealEdgeLength: () => 110,
      nodeRepulsion: () => 400000,
      edgeElasticity: () => 100,
      gravity: 80,
      componentSpacing: 80,
    }).run()

    const ciclos = cy.edges('.ciclo')
    let quadro = 0
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      ciclos.style('line-style', 'solid')
    } else if (ciclos.nonempty()) {
      const correr = (t: number) => {
        ciclos.style('line-dash-offset', -((t / 40) % 14))
        quadro = requestAnimationFrame(correr)
      }
      quadro = requestAnimationFrame(correr)
    }

    return () => {
      cancelAnimationFrame(quadro)
      cy.destroy()
    }
  }, [transacoes, achados, contasRisco])

  return <div ref={div} className="grafo" />
}

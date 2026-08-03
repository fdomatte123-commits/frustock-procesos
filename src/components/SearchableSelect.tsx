import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Search, X, Check } from 'lucide-react';

export interface SelectOption {
  value: number;
  /** Texto principal que se busca y se muestra (ej. "Ribbing") */
  label: string;
  /** Texto secundario a la derecha (ej. "Tol 6%") */
  hint?: string;
  /** Marca visual del tipo de defecto */
  tone?: 'calidad' | 'condicion';
}

interface Props {
  options: SelectOption[];
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  emptyText?: string;
}

/** Quita tildes y pasa a minúsculas para que "rugosidad" encuentre "Rugosidád" */
const normalizar = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Selector con buscador integrado.
 * Pensado para listas largas en pantallas táctiles: se abre, se escribe
 * y la lista se filtra en tiempo real sin necesidad de hacer scroll.
 */
export const SearchableSelect: React.FC<Props> = ({
  options,
  value,
  onChange,
  placeholder = 'Escribe para buscar…',
  emptyText = 'Sin coincidencias'
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [highlight, setHighlight] = useState(0);

  const rootRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selected = options.find(o => o.value === value) ?? null;

  const filtradas = useMemo(() => {
    const q = normalizar(query.trim());
    if (!q) return options;
    const terminos = q.split(/\s+/);
    return options.filter(o => {
      const texto = normalizar(`${o.label} ${o.hint ?? ''}`);
      return terminos.every(t => texto.includes(t));
    });
  }, [options, query]);

  // Cerrar al tocar fuera del componente
  useEffect(() => {
    if (!open) return;
    const fuera = (e: MouseEvent | TouchEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', fuera);
    document.addEventListener('touchstart', fuera);
    return () => {
      document.removeEventListener('mousedown', fuera);
      document.removeEventListener('touchstart', fuera);
    };
  }, [open]);

  // Al abrir: limpiar búsqueda, resaltar la opción actual y enfocar el campo
  useEffect(() => {
    if (!open) return;
    setQuery('');
    const idx = options.findIndex(o => o.value === value);
    setHighlight(idx >= 0 ? idx : 0);
    const t = setTimeout(() => inputRef.current?.focus(), 40);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Al filtrar, volver al primer resultado
  useEffect(() => {
    setHighlight(0);
  }, [query]);

  // Mantener visible la opción resaltada
  useEffect(() => {
    if (!open || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(`[data-idx="${highlight}"]`);
    if (el) el.scrollIntoView({ block: 'nearest' });
  }, [highlight, open]);

  const elegir = (op: SelectOption) => {
    onChange(op.value);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlight(h => Math.min(h + 1, filtradas.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlight(h => Math.max(h - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const op = filtradas[highlight];
      if (op) elegir(op);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  const colorTono = (tone?: string) =>
    tone === 'condicion' ? '#F59E0B' : '#34D399';

  return (
    <div ref={rootRef} style={{ position: 'relative' }}>
      {/* Campo cerrado */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="form-select"
        style={{
          width: '100%',
          textAlign: 'left',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '8px',
          cursor: 'pointer'
        }}
      >
        <span style={{
          display: 'flex', alignItems: 'center', gap: '8px',
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
        }}>
          {selected && (
            <span style={{
              width: '7px', height: '7px', borderRadius: '50%',
              background: colorTono(selected.tone), flexShrink: 0
            }} />
          )}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {selected ? selected.label : 'Seleccionar…'}
          </span>
          {selected?.hint && (
            <span style={{ color: '#94A3B8', fontSize: '0.8rem', flexShrink: 0 }}>({selected.hint})</span>
          )}
        </span>
        <ChevronDown size={16} style={{ flexShrink: 0, color: '#94A3B8', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
      </button>

      {/* Panel desplegable */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 6px)',
          left: 0,
          right: 0,
          zIndex: 60,
          background: '#0F172A',
          border: '1px solid #475569',
          borderRadius: '12px',
          boxShadow: '0 18px 40px rgba(2,6,23,0.65)',
          overflow: 'hidden'
        }}>
          {/* Buscador */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '9px 12px', borderBottom: '1px solid #334155', background: '#111C33'
          }}>
            <Search size={15} color="#64748B" style={{ flexShrink: 0 }} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={placeholder}
              autoComplete="off"
              style={{
                flex: 1, background: 'transparent', border: 'none', outline: 'none',
                color: '#F1F5F9', fontSize: '0.9rem', fontFamily: 'inherit', minWidth: 0
              }}
            />
            {query && (
              <button
                type="button"
                onClick={() => { setQuery(''); inputRef.current?.focus(); }}
                style={{ background: 'transparent', border: 'none', color: '#64748B', cursor: 'pointer', display: 'flex', padding: 0 }}
              >
                <X size={15} />
              </button>
            )}
          </div>

          {/* Resultados */}
          <div ref={listRef} style={{ maxHeight: '260px', overflowY: 'auto' }}>
            {filtradas.length === 0 ? (
              <div style={{ padding: '18px 12px', textAlign: 'center', color: '#64748B', fontSize: '0.82rem' }}>
                {emptyText}
              </div>
            ) : (
              filtradas.map((op, i) => {
                const esActual = op.value === value;
                const resaltada = i === highlight;
                return (
                  <button
                    key={op.value}
                    type="button"
                    data-idx={i}
                    onMouseEnter={() => setHighlight(i)}
                    onClick={() => elegir(op)}
                    style={{
                      width: '100%',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '9px',
                      padding: '11px 12px',
                      background: resaltada ? 'rgba(52,211,153,0.10)' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #1E293B',
                      color: '#E2E8F0',
                      fontSize: '0.88rem',
                      fontFamily: 'inherit',
                      textAlign: 'left',
                      cursor: 'pointer'
                    }}
                  >
                    <span style={{
                      width: '7px', height: '7px', borderRadius: '50%',
                      background: colorTono(op.tone), flexShrink: 0
                    }} />
                    <span style={{ flex: 1, fontWeight: esActual ? 800 : 500 }}>{op.label}</span>
                    {op.hint && (
                      <span style={{ color: '#94A3B8', fontSize: '0.76rem', flexShrink: 0 }}>{op.hint}</span>
                    )}
                    {esActual && <Check size={15} color="#34D399" style={{ flexShrink: 0 }} />}
                  </button>
                );
              })
            )}
          </div>

          {/* Pie: leyenda de colores */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: '14px',
            padding: '7px 12px', borderTop: '1px solid #334155',
            background: '#111C33', fontSize: '0.68rem', color: '#64748B'
          }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#34D399' }} /> Calidad
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F59E0B' }} /> Condición
            </span>
            <span style={{ marginLeft: 'auto' }}>{filtradas.length} de {options.length}</span>
          </div>
        </div>
      )}
    </div>
  );
};

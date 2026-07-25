import { useEffect, useRef, useState } from "react";

export default function AutocompleteInput({ value, onChange, onSelect, search, placeholder, disabled, error, clearOnSelect }) {
  const [input, setInput] = useState(value || "");
  const [results, setResults] = useState([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(!!value);
  const ref = useRef(null);
  const timer = useRef(null);

  useEffect(() => { setInput(value || ""); setSelected(!!value); }, [value]);

  const doSearch = async (q) => {
    if (q.length < 1) { setResults([]); setOpen(false); return; }
    setLoading(true);
    try {
      const data = await search(q);
      if (Array.isArray(data)) setResults(data);
      else setResults([]);
      setOpen(data && data.length > 0);
    } catch { setResults([]); } finally { setLoading(false); }
  };

  const handleInput = (e) => {
    const v = e.target.value;
    setInput(v);
    setSelected(false);
    onChange("");
    clearTimeout(timer.current);
    timer.current = setTimeout(() => doSearch(v), 200);
  };

  const handleSelect = (item) => {
    setSelected(true);
    setOpen(false);
    onChange(item.id);
    if (onSelect) onSelect(item);
    if (clearOnSelect) setInput("");
    else setInput(item.name);
  };

  const handleBlur = () => {
    setTimeout(() => {
      if (!selected && input.trim()) {
        onChange("");
      }
      setOpen(false);
    }, 200);
  };

  return (
    <div className="autocomplete-wrap" ref={ref}>
      <input
        type="text"
        value={input}
        onChange={handleInput}
        onFocus={() => input.trim() && doSearch(input)}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={error ? "input-error" : ""}
        autoComplete="off"
      />
      {loading && <span className="ac-spinner" />}
      {open && results.length > 0 && (
        <ul className="ac-dropdown">
          {results.map((item) => (
            <li key={item.id} onMouseDown={() => handleSelect(item)} className="ac-item">
              <span className="ac-name">{item.name}</span>
              {item.category && <span className="ac-cat">{item.category}</span>}
            </li>
          ))}
        </ul>
      )}
      {error && <span className="ac-error">{error}</span>}
    </div>
  );
}

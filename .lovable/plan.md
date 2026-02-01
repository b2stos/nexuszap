
# Correção: Player de Áudio não Reproduz

## Problema Identificado

O componente `AudioPlayer` no arquivo `src/components/inbox/MessageBubble.tsx` tem um bug:

```typescript
// CÓDIGO ATUAL (BUGADO)
<button onClick={() => setIsPlaying(!isPlaying)}>
  {/* Apenas troca o ícone, não toca o áudio! */}
</button>

<audio src={src} className="hidden" />
// ↑ Elemento existe mas ninguém chama .play() ou .pause()
```

O botão **apenas alterna o estado visual** (`isPlaying`), mas **nunca chama** `audio.play()` ou `audio.pause()`.

## Solução

Usar `useRef` para referenciar o elemento `<audio>` e controlar a reprodução:

```typescript
function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  // ...
  
  const togglePlay = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
  };
  
  return (
    <button onClick={togglePlay}>...</button>
    <audio ref={audioRef} src={src} />
  );
}
```

## Arquivo a Modificar

| Arquivo | Alteração |
|---------|-----------|
| `src/components/inbox/MessageBubble.tsx` | Corrigir `AudioPlayer` para usar `useRef` e chamar `.play()/.pause()` |

## Melhorias Adicionais

Além da correção principal, vou adicionar:
1. **Barra de progresso funcional** - mostrar avanço visual da reprodução
2. **Tratamento de erro** - caso o áudio não carregue (URL expirada do WhatsApp)
3. **Seek** - permitir clicar na barra para pular para um ponto do áudio

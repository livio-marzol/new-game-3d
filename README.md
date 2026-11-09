# New Game 3D - Third Person Action

Jogo 3D em terceira pessoa construído do zero utilizando **Three.js** e **Vite**, com suporte a modelo de personagem rigged (.glb), animações Mixamo (Idle / Walk), iluminação dinâmica com sombras em tempo real e câmera sobre o ombro estilo *Resident Evil*.

---

## 🎮 Controles

- **`W`, `A`, `S`, `D`** ou **`Setas direcionais`**: Movimentar o personagem (com aceleração, rotação suave e desaceleração).
- **`Shift`**: Correr (aumenta velocidade e ajusta escala da animação de passos).
- **`Mouse (Clique & Arraste)`**: Girar câmera em 360° ao redor do personagem.
- **`C`**: Alternar modos de câmera:
  1. *Ombro / Resident Evil* (Over-the-shoulder com offset dinâmico)
  2. *Centralizada* (Câmera clássica em terceira pessoa)
  3. *Panorâmica* (Visão mais ampla)

---

## 🛠️ Tecnologias e Recursos

- **Three.js** (`WebGLRenderer`, `PCFSoftShadowMap`, `ACESFilmicToneMapping`)
- **GLTFLoader**: Carregamento assíncrono do `player.glb` com barra de progresso.
- **Bounding Box Automático**: Ajuste de escala realista (~1.8m de altura humana) e fixação dos pés no plano `y = 0`.
- **AnimationMixer**: Transições suaves (`crossFadeFrom`) entre o ciclo de animação `Idle` e `Walk`.
- **Câmera Suave**: Interpolação exponencial (`lerp`) para eliminar tremores de rastreamento.
- **Iluminação & Cenário**:
  - `DirectionalLight` de 2048x2048 para sombras nítidas acompanhando o jogador.
  - `HemisphereLight` para iluminação ambiental suave entre céu e solo.
  - Chão com grid procedural texturizado e obstáculos/colunas para projeção de sombras.

---

## 🚀 Como Executar

### 1. Clonar o repositório
```bash
git clone https://github.com/livio-marzol/new-game-3d.git
cd new-game-3d
```

### 2. Instalar dependências
```bash
npm install
```

### 3. Iniciar o servidor de desenvolvimento
```bash
npm run dev
```
Acesse no seu navegador: [http://localhost:3000](http://localhost:3000)

### 4. Gerar build de produção
```bash
npm run build
```

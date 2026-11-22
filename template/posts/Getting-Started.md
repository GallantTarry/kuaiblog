# Welcome to KuaiBlog

> **KuaiBlog** is a zero-build-step Markdown blog and knowledge-base engine built on Docsify with **Geek Dark** & **Pastel Light** dual themes, IDE-grade syntax highlighting, MathJax LaTeX, Mermaid 12 diagrams, APlayer/DPlayer media tags, and automatic search cache invalidation.

## 1. Switching Themes

- **Click** the floating circle button at the bottom-right corner to toggle the sidebar.
- **Long-press (hold for 0.5s)** the bottom-right floating circle button to switch between **Geek Dark** (`dark`) and **Pastel Aurora** (`light`) themes.

## 2. IDE-Grade Syntax Highlighting

```go
package main

import "fmt"

func main() {
    for i := 0; i < 3; i++ {
        fmt.Println("Hello, KuaiBlog!")
    }
}
```

## 3. Mathematics & Diagrams

Inline Euler's identity $e^{i\pi} + 1 = 0$ and display math:

$$
\int_{-\infty}^{\infty} e^{-x^2} \, dx = \sqrt{\pi}
$$

```mermaid
flowchart LR
    A["Write Markdown in posts/"] --> B["Run npx kuaiblog build or refresh_sidebar.bat"]
    B --> C["Auto-generate _sidebar.md + search-version.js + feed.xml"]
```

## 4. Custom Audio, Video & Image Syntax

Embed video, audio, and zoomable images in Markdown:

```html
<!-- Video Player (resolved from root index.html) -->
<tukuai-player url="media/videos/demo.mp4" title="demo"></tukuai-player>

<!-- Audio Player (resolved from root index.html) -->
<tukuai-audio
  url="media/music/demo.mp3"
  name="Track Title"
  artist="Artist Name"
  cover="media/music/cover.png">
</tukuai-audio>
```

```markdown
<!-- Standard Markdown Image (resolved relative to the current .md file depth) -->
![Sample Image](../../media/the_birthday.jpg)
```

## 5. Responsive Tables

| Feature | Syntax / Trigger | Description |
| :--- | :--- | :--- |
| Theme Toggle | Long-press bottom-right button (500ms) | Switches Geek Dark and Pastel Light themes |
| CRT Reboot | Click sidebar top heading | Plays CRT turn-off/on effect |
| Image Lightbox | Click any article image | Opens Viewer.js zoomable gallery |
| Folder Lock | Configure `auth` in `kuaiblog.config.js` | Protects private directories with a password |

import { Icon } from './components/Icon';
import { UploadForm } from './components/UploadForm';
export function App() {
  return <>
    <a className="skip-link" href="#contenido">Saltar al contenido</a>
    <header className="topbar"><a className="brand" href="#contenido"><span className="brand-mark"><Icon name="vault" size={25}/></span><span>Cloud Media <strong>Vault</strong></span></a>
      <nav aria-label="Navegación principal"><a href="#subir">Añadir archivo <Icon name="arrow" size={16}/></a></nav>
      <span className="workspace-label"><span className="status-dot"/>Espacio compartido</span>
    </header>
    <main id="contenido"><section className="intro" aria-labelledby="page-title"><div><p className="eyebrow">TU BIBLIOTECA MULTIMEDIA</p>
      <h1 id="page-title">Tu contenido,<br/><span>siempre a mano.</span></h1>
      <p className="intro-copy">Guarda imágenes, videos y documentos PDF.<br className="desktop-break"/> Un espacio para encontrar lo que importa.</p></div>
      <div className="format-stack" aria-hidden="true"><span className="format-tile format-image"><Icon name="image" size={33}/><small>IMAGEN</small></span><span className="format-tile format-video"><Icon name="video" size={33}/><small>VIDEO</small></span><span className="format-tile format-pdf"><Icon name="file" size={33}/><small>PDF</small></span></div>
    </section><div className="workspace"><UploadForm/><section className="welcome-panel" aria-labelledby="welcome-title"><p className="eyebrow">UN ESPACIO, MUCHAS POSIBILIDADES</p><h2 id="welcome-title">Cada archivo tiene<br/>su lugar.</h2><p>Ponle un título que puedas recordar y añade tu nombre. Tu biblioteca empieza con un archivo.</p>
      <div className="format-guide"><div><Icon name="image"/><span>Imágenes<small>JPEG, PNG y WebP</small></span></div><div><Icon name="video"/><span>Videos<small>MP4 y WebM</small></span></div><div><Icon name="file"/><span>Documentos<small>PDF</small></span></div></div><p className="size-note">Hasta <strong>10 MB</strong> por archivo.</p></section></div>
    </main><footer className="footer"><span>Cloud Media Vault</span><span>Un lugar para lo que creas.</span></footer>
  </>;
}

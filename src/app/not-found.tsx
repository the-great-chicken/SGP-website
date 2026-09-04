import { ArrowLeft, Feather } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <div className="shell not-found">
      <span className="not-found-code">404</span>
      <Feather size={30} />
      <h1>Cette page s’est envolée.</h1>
      <p>Elle n’existe pas, ou n’a pas encore rejoint les archives de la SGP.</p>
      <Link className="button ghost" href="/">
        <ArrowLeft size={16} /> Retour à l’accueil
      </Link>
    </div>
  );
}


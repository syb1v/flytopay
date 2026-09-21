import { PreferencesPanel } from "../../components/settings/PreferencesPanel";
import { CheckoutPanel } from "../../components/payments/CheckoutPanel";

export default function CabinetPage() {
  return <main className="shell"><p className="eyebrow">Личный кабинет</p><h1>Flytopay</h1><p className="lead">Управляйте картами и настройками в одном месте.</p><PreferencesPanel /><CheckoutPanel /></main>;
}

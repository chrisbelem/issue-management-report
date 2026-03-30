# Issue Management Report — Global Lending

Gera automaticamente o dashboard HTML semanal de Issues & Action Plans.

---

## Estrutura de pastas

```
issue-management-report/
├── data/
│   ├── input/               ← coloque os CSVs aqui a cada semana
│   └── config/
│       └── people_mapping.csv  ← mapeamento pessoa → BU + BA (editar quando necessário)
├── template/
│   └── dashboard_template.html ← layout do dashboard (não editar)
├── output/
│   └── dashboard.html          ← arquivo gerado pelo script
└── scripts/
    └── generate_report.py      ← script principal
```

---

## Passo a passo semanal

### 1. Exportar os dados do Databricks

Execute as duas queries no Databricks e faça o download como CSV:

| Arquivo esperado       | Conteúdo                              |
|------------------------|---------------------------------------|
| `issues_raw.csv`       | Lista de Issues (query de issues)     |
| `action_plans_raw.csv` | Lista de Action Plans (query de APs)  |

Coloque os dois arquivos na pasta `data/input/`.

### 2. Exportar o report da AWS QuickSight *(opcional)*

Faça o download do report de NP&Fs da AWS QuickSight e salve como:

```
data/input/npf_report.csv
```

> Se esse arquivo não existir, o script roda normalmente — todos os issues serão tratados como "Issue" (não "Potential Issue") e a coluna NP&F+ ficará vazia.

### 3. Rodar o script

Abra o Terminal, navegue até a pasta do projeto e execute:

```bash
cd ~/issue-management-report
python3 scripts/generate_report.py
```

O script vai mostrar mensagens de progresso. Se algum nome não estiver no mapeamento de pessoas, ele avisa no terminal (ver seção abaixo).

### 4. Abrir o dashboard

O arquivo gerado estará em:

```
output/dashboard.html
```

Abra no navegador normalmente (duplo clique ou arraste para o Chrome/Safari).

### 5. Publicar *(opcional)*

Para publicar no GitHub Pages, faça commit do `output/dashboard.html` e push:

```bash
git add output/dashboard.html
git commit -m "Weekly report $(date +%Y-%m-%d)"
git push
```

Configure GitHub Pages no repositório para servir a partir da pasta `output/` (ou raiz).

---

## Manutenção do mapeamento de pessoas

Quando o script avisar `"X pessoa(s) sem BU/BA no mapeamento"`, adicione a pessoa no arquivo:

```
data/config/people_mapping.csv
```

Formato:
```
name,bu,ba
Nome Completo,Nome da BU,Nome da BA
```

---

## Configurações avançadas

As constantes abaixo ficam no topo de `scripts/generate_report.py`:

| Constante              | Padrão                           | O que faz                                     |
|------------------------|----------------------------------|-----------------------------------------------|
| `BCO_NAMES`            | `['Christiane Belem', 'Ingrid Sgulmar']` | Nomes das BCOs para regras de Action Owner |
| `NPF_LINK_COL_INDEX`   | `16`                             | Coluna do NP&F no export da AWS (0-based)     |
| `NPF_ISSUE_CODE_COL_INDEX` | `0`                          | Coluna do código do issue no export da AWS    |
| `ALERT_WINDOW_DAYS`    | `14`                             | Dias para alerta "AP will overdue < 2 weeks"  |

---

## Requisitos

- Python 3.8 ou superior (sem instalação de pacotes adicionais)
- Conexão com internet apenas para o dashboard (Bootstrap/Select2 via CDN)

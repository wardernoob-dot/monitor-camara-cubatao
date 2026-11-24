"""Configuracao comum dos testes."""
import os

from hypothesis import settings

# No robo (GitHub Actions define CI=true) os testes por propriedade rodam com sementes fixas: um teste
# quebrado bloqueia a coleta, entao ele precisa falhar sempre ou nunca, nao por sorteio. Na maquina de
# quem desenvolve o gerador continua aleatorio e cada rodada explora casos novos.
settings.register_profile("ci", derandomize=True, print_blob=True)
settings.register_profile("dev", print_blob=True)
# caca longa, a mao: HYPOTHESIS_PROFILE=longo python -m pytest tests/test_propriedades.py
settings.register_profile("longo", max_examples=3000, deadline=None, print_blob=True)
settings.load_profile(os.environ.get("HYPOTHESIS_PROFILE") or ("ci" if os.environ.get("CI") else "dev"))

@echo off
setlocal
set "ROOT=%~dp0"
"%ROOT%.venv\Scripts\python.exe" -m streamlit run "%ROOT%Home.py"
endlocal

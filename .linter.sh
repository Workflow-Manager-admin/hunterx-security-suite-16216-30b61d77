#!/bin/bash
cd /home/kavia/workspace/code-generation/hunterx-security-suite-16216-30b61d77/hunterx_security_suite
npm run build
EXIT_CODE=$?
if [ $EXIT_CODE -ne 0 ]; then
   exit 1
fi


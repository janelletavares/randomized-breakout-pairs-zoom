#!/bin/bash

for i in {1..5}
do
  echo "test case ${i}"
  HOSTNAME="TestUser${i}" python3 participant.py &
done

wait

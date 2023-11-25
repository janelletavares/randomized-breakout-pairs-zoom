#!/bin/bash

for i in {1..5}
do
  echo "test case ${i}"
  DISPLAY_NAME="TestUser${i}" node farm.js &
done

wait

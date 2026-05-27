import duckdb
print(duckdb.query("DESCRIBE SELECT * FROM read_parquet('data/pob_municipios.parquet')").df())

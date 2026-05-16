using System;
using System.Text.Json.Serialization;

namespace Api.Models;

public class Ganho
{
    public int Id { get; set; }
    public string Descricao { get; set; } = string.Empty;
    public decimal Valor { get; set; }
    public DateTime Data { get; set; }
    
    // Chave estrangeira
    public int UserId { get; set; }
    
    // Navegação - adicione [JsonIgnore] para evitar loop
    [JsonIgnore]
    public User? User { get; set; }
}
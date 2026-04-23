-- dbo.0_client_quote_0_query



/* view 0_client_quote_0_query: add view */


/* view 0_client_quote_0_query: add view */


/* view 0_client_quote_0_query: add view */

/* view 0_client_quote_0_query: add view */


/* view 0_client_quote_0_query: add view */
CREATE VIEW [dbo].[0_client_quote_0_query]
AS
SELECT DISTINCT dbo.k11_tab.idnk11_k11, dbo.k33_tab.idnk33_k33
FROM         dbo.k34_tab INNER JOIN
                      dbo.k11_tab ON dbo.k34_tab.idnk11_k34 = dbo.k11_tab.idnk11_k11 INNER JOIN
                      dbo.k33_tab ON dbo.k34_tab.idnk33_k34 = dbo.k33_tab.idnk33_k33






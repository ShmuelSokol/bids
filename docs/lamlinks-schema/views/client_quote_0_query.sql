-- dbo.client_quote_0_query



/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */

/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */


/* view client_quote_0_query: add view */
CREATE VIEW [dbo].[client_quote_0_query]
AS
SELECT DISTINCT dbo.k33_tab.idnk33_k33, dbo.solicitation_line_1_view.source_k09, dbo.solicitation_line_1_view.idnk11_k11
FROM         dbo.k34_tab INNER JOIN
                      dbo.k33_tab ON dbo.k34_tab.idnk33_k34 = dbo.k33_tab.idnk33_k33 INNER JOIN
                      dbo.solicitation_line_1_view ON dbo.k34_tab.idnk11_k34 = dbo.solicitation_line_1_view.idnk11_k11



















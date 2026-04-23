-- dbo.our_quote_line_7_view



/* view our_quote_line_7_view: add view */


/* view our_quote_line_7_view: add view */


/* view our_quote_line_7_view: add view */

/* view our_quote_line_7_view: add view */


/* view our_quote_line_7_view: add view */
CREATE VIEW dbo.our_quote_line_7_view
AS
SELECT        dbo.our_quote_line_6_view.idnk11_qry, dbo.our_quote_line_6_view.idnk11_qte, dbo.k33_tab.o_stat_k33, dbo.k33_tab.qotref_k33, dbo.k33_tab.s_stme_k33, dbo.k33_tab.s_stat_k33, dbo.our_quote_line_3_view.*
FROM            dbo.our_quote_line_6_view INNER JOIN
                         dbo.our_quote_line_3_view ON dbo.our_quote_line_6_view.idnk34_k34 = dbo.our_quote_line_3_view.idnk34_k34 INNER JOIN
                         dbo.k33_tab ON dbo.our_quote_line_3_view.idnk33_k33 = dbo.k33_tab.idnk33_k33






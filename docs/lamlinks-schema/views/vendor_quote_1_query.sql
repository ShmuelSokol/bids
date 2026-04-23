-- dbo.vendor_quote_1_query



/* view vendor_quote_1_query: add view */


/* view vendor_quote_1_query: add view */


/* view vendor_quote_1_query: add view */

/* view vendor_quote_1_query: add view */
/* view vendor_quote_1_query: add view 
 view vendor_quote_1_query: add view 
 view vendor_quote_1_query: add view 
 view vendor_quote_1_query: add view 
 view vendor_quote_1_query: add view 
 view vendor_quote_1_query: add view 
 view vendor_quote_1_query: add view 
 view vendor_quote_1_query: add view 
 view vendor_quote_1_query: add view 
 view vendor_quote_1_query: add view 
 view vendor_quote_1_query: add view 
 view vendor_quote_1_query: add view 
 view vendor_quote_1_query: add view 
 view vendor_quote_1_query: add view */
CREATE VIEW dbo.vendor_quote_1_query
AS
SELECT DISTINCT 
                         dbo.k11_tab.idnk11_k11, dbo.k43_tab.idnk43_k43, dbo.k56_tab.idnk56_k56, dbo.k56_tab.q_type_k56, dbo.k56_tab.p_um_k56, dbo.k57_tab.idnk57_k57, dbo.k57_tab.untcst_k57, dbo.k57_tab.dlyaro_k57, dbo.k57_tab.valdte_k57, 
                         dbo.k55_tab.idnk55_k55, dbo.k55_tab.qotdte_k55, dbo.k55_tab.qrefno_k55, dbo.k08_tab.idnk08_k08, dbo.k74_tab.idnk74_k74, dbo.k11_tab.pr_num_k11, dbo.k57_tab.minqty_k57, dbo.k56_tab.p_cage_k56, 
                         dbo.k56_tab.partno_k56, dbo.k56_tab.su_lbs_k56
FROM            dbo.k57_tab INNER JOIN
                         dbo.k56_tab ON dbo.k56_tab.idnk56_k56 = dbo.k57_tab.idnk56_k57 INNER JOIN
                         dbo.k55_tab ON dbo.k56_tab.idnk55_k56 = dbo.k55_tab.idnk55_k55 INNER JOIN
                         dbo.k43_tab ON dbo.k56_tab.idnk43_k56 = dbo.k43_tab.idnk43_k43 INNER JOIN
                         dbo.k40_tab ON dbo.k43_tab.idnk40_k43 = dbo.k40_tab.idnk40_k40 INNER JOIN
                         dbo.k08_tab ON dbo.k40_tab.idnk08_k40 = dbo.k08_tab.idnk08_k08 INNER JOIN
                         dbo.k45_tab ON dbo.k43_tab.idnk43_k43 = dbo.k45_tab.idnk43_k45 INNER JOIN
                         dbo.k37_tab ON dbo.k45_tab.idnk37_k45 = dbo.k37_tab.idnk37_k37 LEFT OUTER JOIN
                         dbo.k11_tab ON dbo.k37_tab.idnvrq_k37 = dbo.k11_tab.idnk11_k11 AND dbo.k37_tab.vrqtyp_k37 = 'k11' LEFT OUTER JOIN
                         dbo.k74_tab ON dbo.k37_tab.idnvrq_k37 = dbo.k74_tab.idnk74_k74 AND dbo.k37_tab.vrqtyp_k37 = 'k74'




